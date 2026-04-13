import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { getCategories, subscribeToCategories, getSetting, setSetting, initDefaults } from './db';

// ── State shape ───────────────────────────────────────────────────────────────
const initialState = {
  view: 'loading',          // 'loading' | 'firstLaunch' | 'child' | 'pinEntry' | 'admin' | 'error'
  categories: [],
  currentCategoryId: null,
  displaySize: 'medium',    // 'small' | 'medium' | 'large'
  isInitialised: false,
  error: null,
};

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        view: action.view,
        categories: action.categories,
        currentCategoryId: action.categories[0]?.id ?? null,
        displaySize: action.displaySize,
        isInitialised: true,
      };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_CATEGORIES':
      return {
        ...state,
        categories: action.categories,
        currentCategoryId:
          action.categories.find(c => c.id === state.currentCategoryId)
            ? state.currentCategoryId
            : action.categories[0]?.id ?? null,
      };
    case 'SET_CURRENT_CATEGORY':
      return { ...state, currentCategoryId: action.id };
    case 'SET_DISPLAY_SIZE':
      return { ...state, displaySize: action.size };
    case 'INIT_ERROR':
      return { ...state, view: 'error', error: action.error, isInitialised: true };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const unsubCatsRef = useRef(null);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const pin = await getSetting('adminPin');
        if (!pin) {
          // First launch — no defaults yet
          dispatch({ type: 'INIT', view: 'firstLaunch', categories: [], displaySize: 'medium' });
          return;
        }
        await initDefaults();
        const categories = await getCategories();
        const displaySize = (await getSetting('displaySize')) ?? 'medium';
        dispatch({ type: 'INIT', view: 'child', categories, displaySize });
      } catch (err) {
        console.error('App init failed:', err);
        dispatch({ type: 'INIT_ERROR', error: err.message });
      }
    }
    init();
    return () => { unsubCatsRef.current?.(); };
  }, []);

  // ── Real-time category sync ───────────────────────────────────────────────────
  // Starts once the app has initialised (past first-launch or normal boot).
  // Any device that adds, renames, reorders, or deletes a category instantly
  // pushes that change to every other open device.
  useEffect(() => {
    if (!state.isInitialised || state.view === 'firstLaunch') return;
    unsubCatsRef.current?.(); // cancel any previous listener
    unsubCatsRef.current = subscribeToCategories(categories => {
      dispatch({ type: 'SET_CATEGORIES', categories });
    });
    return () => { unsubCatsRef.current?.(); };
  }, [state.isInitialised, state.view]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const actions = {
    setView: (view) => dispatch({ type: 'SET_VIEW', view }),

    // refreshCategories is kept for compatibility but the live listener
    // makes manual refreshes unnecessary in most cases.
    refreshCategories: async () => {
      const categories = await getCategories();
      dispatch({ type: 'SET_CATEGORIES', categories });
    },

    setCurrentCategory: (id) => dispatch({ type: 'SET_CURRENT_CATEGORY', id }),

    setDisplaySize: async (size) => {
      await setSetting('displaySize', size);
      dispatch({ type: 'SET_DISPLAY_SIZE', size });
    },

    completeFirstLaunch: async () => {
      await initDefaults();
      const categories = await getCategories();
      const displaySize = (await getSetting('displaySize')) ?? 'medium';
      dispatch({ type: 'INIT', view: 'admin', categories, displaySize });
    },
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
