import { SnackbarProvider } from 'notistack'
import QuickPitchHome from './QuickPitchHome'

export default function App() {
  return (
    <SnackbarProvider maxSnack={3}>
      <QuickPitchHome />
    </SnackbarProvider>
  )
}
