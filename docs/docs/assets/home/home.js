// the footer's legal pop-ups: showModal() gives Escape, the focus trap and focus return
for (const button of document.querySelectorAll('[data-dialog]')) {
  const dialog = document.getElementById(button.dataset.dialog)
  button.addEventListener('click', () => dialog.showModal())
  // a click on the backdrop lands on the dialog itself, outside its content box
  dialog.addEventListener('click', (e) => {
    const box = dialog.getBoundingClientRect()
    const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom
    if (e.target === dialog && !inside) dialog.close()
  })
}
