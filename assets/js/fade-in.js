// js/fade-in.js
document.addEventListener("DOMContentLoaded", function() {
  const sections = document.querySelectorAll('.fade-in-section'); // Select sections with the fade-in effect

  function checkVisibility() {
      sections.forEach(section => {
          const rect = section.getBoundingClientRect();
          const windowHeight = (window.innerHeight || document.documentElement.clientHeight);

          // Check if section is in the viewport
          if (rect.top <= windowHeight && rect.bottom >= 0) {
              section.classList.add('visible'); // Add visible class to fade in
          } else {
              section.classList.remove('visible'); // Remove visible class to fade out
          }
      });
  }

  // Check visibility on scroll and load
  window.addEventListener('scroll', checkVisibility);
  checkVisibility(); // Initial check on page load
});