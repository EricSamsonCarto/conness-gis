// the Spinner look on a plain-DOM button, its content hidden. returns done()
export function showBusy(button: HTMLElement, size = 16): () => void {
  const spinner = document.createElement('span')
  spinner.className = 'kit-spinner'
  spinner.setAttribute('aria-hidden', 'true')
  spinner.style.width = spinner.style.height = `${size}px`
  button.append(spinner)
  button.classList.add('kit-busy')
  button.setAttribute('aria-busy', 'true')
  return () => {
    spinner.remove()
    button.classList.remove('kit-busy')
    button.removeAttribute('aria-busy')
  }
}
