export default function Header({ cartCount = 0 }) {
  return (
    <header className="border-b border-gray-100 sticky top-0 bg-white z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-lg font-medium tracking-widest uppercase">Velour</span>
        <nav className="hidden md:flex gap-8 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-900">Women</a>
          <a href="#" className="hover:text-gray-900">Men</a>
          <a href="#" className="hover:text-gray-900">Accessories</a>
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
    </header>
  )
}
