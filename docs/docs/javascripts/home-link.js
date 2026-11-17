// the header's "Conness GIS" goes home like the logo next to it. it's plain text in the theme's
// header, so clicks are forwarded to the logo's link (the logo stays the keyboard and screen-reader route)
document.addEventListener('click', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('.md-header__topic:first-child')) return
  const logo = document.querySelector('.md-header .md-logo')
  if (logo) logo.click()
})
