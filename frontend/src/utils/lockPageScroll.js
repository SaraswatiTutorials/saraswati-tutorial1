// Stops the page scrolling behind a popup and returns a function that restores it. Both elements
// are needed: index.css sets overflow-x on html and body, which makes html the element that scrolls.
export function lockPageScroll() {
  const { documentElement, body } = document;
  const previous = [documentElement.style.overflow, body.style.overflow];
  documentElement.style.overflow = "hidden";
  body.style.overflow = "hidden";
  return () => {
    [documentElement.style.overflow, body.style.overflow] = previous;
  };
}
