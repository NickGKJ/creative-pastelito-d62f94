/**
 * AAC App Sync Script
 * Syncs IndexedDB content with the server so all visitors see the same data.
 * - On page load: pulls content from the server and writes to IndexedDB
 * - Continuously polls for server changes so ALL devices stay in sync
 * - When admin makes changes: pushes content to the server
 */
(function () {
  var DB_NAME = 'aac-app';
  var DB_VERSION = 1;
  var API_URL = '/.netlify/functions/content';
  var PUSH_POLL_INTERVAL = 3000;
  var PULL_POLL_INTERVAL = 5000;
  var isSyncing = false;
  var lastSnapshot = '';
  var lastPushTime = 0;
  var lastKnownVersion = 0;
  var pullTimer = null;
  var isInitialized = false;

  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains('categories')) {
          var catStore = db.createObjectStore('categories', { keyPath: 'id' });
          catStore.createIndex('order', 'order');
        }
        if (!db.objectStoreNames.contains('items')) {
          var itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('categoryId', 'categoryId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function getAllFromStore(db, storeName) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var store = tx.objectStore(storeName);
      var request = store.getAll();
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function clearAndWriteStore(db, storeName, items) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      store.clear();
      items.forEach(function (item) { store.put(item); });
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve) {
      if (!blob || !(blob instanceof Blob)) { resolve(null); return; }
      var reader = new FileReader();
      reader.onloadend = function () { resolve(reader.result); };
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(dataUrl) {
    if (!dataUrl) return null;
    try {
      var parts = dataUrl.split(',');
      var mimeMatch = parts[0].match(/:(.*?);/);
      var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      var binary = atob(parts[1]);
      var array = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return new Blob([array], { type: mime });
    } catch (e) {
      return null;
    }
  }

  // Serialize items: convert Blob fields to base64 strings
  function serializeItems(items) {
    return Promise.all(items.map(function (item) {
      return Promise.all([
        blobToBase64(item.imageBlob),
        blobToBase64(item.audioBlob)
      ]).then(function (results) {
        var serialized = {};
        Object.keys(item).forEach(function (key) {
          if (key !== 'imageBlob' && key !== 'audioBlob') {
            serialized[key] = item[key];
          }
        });
        serialized.imageData = results[0];
        serialized.audioData = results[1];
        return serialized;
      });
    }));
  }

  // Deserialize items: convert base64 strings back to Blobs
  function deserializeItems(items) {
    return items.map(function (item) {
      var deserialized = {};
      Object.keys(item).forEach(function (key) {
        if (key !== 'imageData' && key !== 'audioData') {
          deserialized[key] = item[key];
        }
      });
      deserialized.imageBlob = base64ToBlob(item.imageData);
      deserialized.audioBlob = base64ToBlob(item.audioData);
      return deserialized;
    });
  }

  // Create a snapshot string for change detection
  // Includes blob sizes to detect image/audio changes
  function makeSnapshot(categories, items) {
    var catData = categories.map(function (c) {
      return c.id + ':' + c.name + ':' + c.emoji + ':' + c.order;
    }).sort().join('|');
    var itemData = items.map(function (i) {
      var imgSize = (i.imageBlob && i.imageBlob.size) ? i.imageBlob.size : 0;
      var audSize = (i.audioBlob && i.audioBlob.size) ? i.audioBlob.size : 0;
      return i.id + ':' + i.categoryId + ':' + i.label + ':' + i.createdAt + ':' + imgSize + ':' + audSize;
    }).sort().join('|');
    return catData + '##' + itemData;
  }

  // Pull content from server and write to IndexedDB
  // Returns: 'updated' if data changed, 'current' if already up to date, 'empty' if no server data
  function pullFromServer() {
    return fetch(API_URL, { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.version || data.version === 0) return 'empty';

        var serverVersion = data.version;

        if (serverVersion <= lastKnownVersion) return 'current';

        var categories = data.categories || [];
        var items = deserializeItems(data.items || []);

        return openDB().then(function (db) {
          isSyncing = true;
          return clearAndWriteStore(db, 'categories', categories)
            .then(function () { return clearAndWriteStore(db, 'items', items); })
            .then(function () {
              db.close();
              isSyncing = false;
              lastKnownVersion = serverVersion;
              // Update snapshot so poll doesn't immediately push back
              lastSnapshot = makeSnapshot(categories, items);
              return 'updated';
            });
        });
      })
      .catch(function (err) {
        console.warn('[AAC Sync] Pull failed:', err);
        isSyncing = false;
        return 'error';
      });
  }

  // Push local IndexedDB content to server
  function pushToServer() {
    if (isSyncing) return Promise.resolve();
    if (Date.now() - lastPushTime < 2000) return Promise.resolve();

    return openDB().then(function (db) {
      return Promise.all([
        getAllFromStore(db, 'categories'),
        getAllFromStore(db, 'items')
      ]).then(function (results) {
        db.close();
        var categories = results[0];
        var items = results[1];

        if (categories.length === 0 && items.length === 0) return;

        var snapshot = makeSnapshot(categories, items);
        if (snapshot === lastSnapshot) return;

        return serializeItems(items).then(function (serializedItems) {
          lastPushTime = Date.now();
          return fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categories: categories,
              items: serializedItems
            })
          })
            .then(function (res) { return res.json(); })
            .then(function (result) {
              if (result.ok) {
                lastSnapshot = snapshot;
                lastKnownVersion = result.version;
              }
            });
        });
      });
    }).catch(function (err) {
      console.warn('[AAC Sync] Push failed:', err);
    });
  }

  // Check if admin view is active
  function isAdminActive() {
    return !!document.querySelector('.admin-view');
  }

  // Continuously poll server for changes and update the page if new data is found
  function startPullPolling() {
    if (pullTimer) return;

    pullTimer = setInterval(function () {
      // Don't pull while admin is actively editing (push takes priority)
      if (isAdminActive() || isSyncing) return;

      pullFromServer().then(function (result) {
        if (result === 'updated') {
          // Server has newer data - reload to show it
          window.location.reload();
        }
      });
    }, PULL_POLL_INTERVAL);
  }

  // Poll for admin changes and push to server
  function startAdminPoll() {
    var wasAdmin = false;

    setInterval(function () {
      var adminNow = isAdminActive();

      // Push periodically while admin is active
      if (adminNow) {
        wasAdmin = true;
        pushToServer();
      }

      // Push once more when admin exits (transition from admin to child view)
      if (wasAdmin && !adminNow) {
        wasAdmin = false;
        pushToServer();
      }
    }, PUSH_POLL_INTERVAL);

    // Also push when leaving the page
    window.addEventListener('beforeunload', function () {
      if (isAdminActive() || lastSnapshot) {
        // Attempt a synchronous push using sendBeacon if possible
        try {
          openDB().then(function (db) {
            Promise.all([
              getAllFromStore(db, 'categories'),
              getAllFromStore(db, 'items')
            ]).then(function (results) {
              db.close();
            });
          });
        } catch (e) {
          // Best effort only
        }
      }
    });
  }

  // Handle visibility change - pull fresh data when tab becomes visible
  function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && isInitialized && !isAdminActive()) {
        // User switched back to this tab - check for updates immediately
        pullFromServer().then(function (result) {
          if (result === 'updated') {
            window.location.reload();
          }
        });
      }
    });
  }

  // Handle online/offline - pull when coming back online
  function setupOnlineHandler() {
    window.addEventListener('online', function () {
      if (isInitialized && !isAdminActive()) {
        pullFromServer().then(function (result) {
          if (result === 'updated') {
            window.location.reload();
          }
        });
      }
    });
  }

  // Initialize: pull from server, then start polling
  function init() {
    // Initialize the snapshot from current IndexedDB state
    openDB().then(function (db) {
      return Promise.all([
        getAllFromStore(db, 'categories'),
        getAllFromStore(db, 'items')
      ]).then(function (results) {
        db.close();
        lastSnapshot = makeSnapshot(results[0], results[1]);
      });
    }).then(function () {
      return pullFromServer();
    }).then(function (result) {
      isInitialized = true;
      if (result === 'updated') {
        // Data was updated from server - reload to show new content
        window.location.reload();
      } else {
        // Start both push and pull polling
        startAdminPoll();
        startPullPolling();
        setupVisibilityHandler();
        setupOnlineHandler();
      }
    }).catch(function (err) {
      console.warn('[AAC Sync] Init failed:', err);
      isInitialized = true;
      startAdminPoll();
      startPullPolling();
      setupVisibilityHandler();
      setupOnlineHandler();
    });
  }

  // Wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
