import React from 'react'
import AppRoutes from './routes/AppRoutes'
import { UserProvider } from './context/user.context'
import { ThemeProvider } from './context/theme.context'

const App = () => {
  return (
    <UserProvider>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </UserProvider>
  )
}

export default App