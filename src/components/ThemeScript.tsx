"use client";

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme') || 'blue';
              document.documentElement.classList.remove('dark', 'theme-blue', 'theme-rose', 'theme-orange', 'theme-default');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else if (theme === 'blue') {
                document.documentElement.classList.add('theme-blue');
              } else if (theme === 'rose') {
                document.documentElement.classList.add('theme-rose');
              } else if (theme === 'orange') {
                document.documentElement.classList.add('theme-orange');
              } else {
                document.documentElement.classList.add('theme-default');
              }
              document.documentElement.setAttribute('data-theme', theme);

              function applyMeta() {
                var current = document.documentElement.getAttribute('data-theme') || 'blue';
                var themeColors = {
                  default: '#f8fafc',
                  blue: '#f0f7ff',
                  rose: '#fff1f5',
                  orange: '#fff8f0',
                  dark: '#0b0f19'
                };
                var meta = document.querySelector('meta[name="theme-color"]');
                if (!meta) {
                  meta = document.createElement('meta');
                  meta.name = 'theme-color';
                  document.head.appendChild(meta);
                }
                meta.content = themeColors[current] || '#f0f7ff';
              }
              applyMeta();
              (function () {
                try {
                  new MutationObserver(function () {
                    applyMeta();
                  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
                } catch(e) {}
              })();
            } catch(e) {}
          })();
        `,
      }}
    />
  );
}
