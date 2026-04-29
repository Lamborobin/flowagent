export default function Header({ cartCount = 0, activeCategory, onNavigate }) {
  const navItems = [
    { label: 'Women', category: 'Clothing', filter: (p) => p.tags?.includes('women') },
    { label: 'Men', category: 'Clothing', filter: (p) => p.tags?.includes('men') },
    { label: 'Accessories', category: 'Accessories' },
    { label: 'Sports', category: 'Sports' },
  ]

  return (
    <header className="border-b border-gray-100 sticky top-0 bg-white z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <button 
          onClick={() => onNavigate('All')} 
          className="text-lg font-medium tracking-widest uppercase hover:opacity-70 transition-opacity"
        >
          Velour
        </button>
        <nav className="hidden md:flex gap-8 text-sm text-gray-500">
          {navItems.map(({ label, category }) => (
            <button
              key={label}
              onClick={() => onNavigate(category)}
              className={`hover:text-gray-900 transition-colors ${
                activeCategory === category ? 'text-gray-900 font-medium' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="text-sm relative">
          Bag
          {cartCount > 0 && (
            <span className="ml-1 text-xs bg-gray-900 text-white rounded-full w-4 h-4 inline-flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile navigation */}
      <nav className="md:hidden flex justify-around border-t border-gray-100 text-xs text-gray-500 py-3">
        {navItems.map(({ label, category }) => (
          <button
            key={label}
            onClick={() => onNavigate(category)}
            className={`hover:text-gray-900 transition-colors ${
              activeCategory === category ? 'text-gray-900 font-medium' : ''
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}
