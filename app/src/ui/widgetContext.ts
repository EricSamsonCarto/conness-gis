import { createContext, useContext } from 'react'

// the widget a component renders inside, so InfoSection follows its settings
export const WidgetIdContext = createContext<string | null>(null)

export const useWidgetId = () => useContext(WidgetIdContext)
