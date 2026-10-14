// Site logo: logo.png in light mode, dark_theme_logo.jpeg in dark mode.
// Only the visible one is downloaded (lazy images that are display:none don't load).

const showFallback = (e) => {
  e.currentTarget.src = "https://placehold.co/100x100?text=ST";
};

export default function BrandLogo({ className = "", alt = "Saraswati Tutorials" }) {
  return (
    <>
      <img src="/logo.png" alt={alt} loading="lazy" className={`${className} dark:hidden`} onError={showFallback} />
      <img src="/dark_theme_logo.jpeg" alt={alt} loading="lazy" className={`${className} hidden dark:block`} onError={showFallback} />
    </>
  );
}
