import React, { useState } from 'react';
import CategoryManager from './CategoryManager';
import ItemManager from './ItemManager';
import AdminSettings from './AdminSettings';

export default function AdminView({ onExit }) {
  const [tab, setTab] = useState('categories'); // 'categories' | 'settings'
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="admin-view">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-badge">Admin</div>
        <div className="admin-header-title">
          {selectedCategory
            ? `${selectedCategory.emoji} ${selectedCategory.name}`
            : 'Manage Content'
          }
        </div>
        <button className="admin-header-exit" onClick={onExit}>
          ▶ Child View
        </button>
      </div>

      {/* Tab bar — hidden when viewing items */}
      {!selectedCategory && (
        <div className="admin-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'categories'}
            className={`admin-tab ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => setTab('categories')}
          >
            🗂 Categories
          </button>
          <button
            role="tab"
            aria-selected={tab === 'settings'}
            className={`admin-tab ${tab === 'settings' ? 'active' : ''}`}
            onClick={() => setTab('settings')}
          >
            ⚙️ Settings
          </button>
        </div>
      )}

      {/* Content */}
      <div className="admin-content">
        {selectedCategory ? (
          <ItemManager
            category={selectedCategory}
            onBack={handleBackToCategories}
          />
        ) : tab === 'categories' ? (
          <CategoryManager onSelectCategory={handleSelectCategory} />
        ) : (
          <AdminSettings />
        )}
      </div>
    </div>
  );
}
