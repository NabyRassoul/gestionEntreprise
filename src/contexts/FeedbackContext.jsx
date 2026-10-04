import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'

// Couleurs MUI alignées sur l'app (bleu Salesforce)
const theme = createTheme({
  palette: { primary: { main: '#0176d3' } },
  typography: { fontFamily: 'inherit', button: { textTransform: 'none', fontWeight: 600 } },
})

const FeedbackContext = createContext(null)

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '', key: 0 })
  const [dialog, setDialog] = useState(null)
  const resolver = useRef(null)

  /** notify('success' | 'error' | 'warning' | 'info', 'message') */
  const notify = useCallback((severity, message, duration = 4000) => {
    setToast({ open: true, severity, message, duration, key: Date.now() })
  }, [])

  /** const ok = await confirm({ title, message, confirmText, severity }) */
  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setDialog(typeof opts === 'string' ? { message: opts } : opts)
      }),
    []
  )

  const closeDialog = (result) => {
    resolver.current?.(result)
    resolver.current = null
    setDialog(null)
  }

  const closeToast = (_, reason) => {
    if (reason === 'clickaway') return
    setToast((t) => ({ ...t, open: false }))
  }

  return (
    <ThemeProvider theme={theme}>
      <FeedbackContext.Provider value={{ notify, confirm }}>
        {children}

        {/* Messages */}
        <Snackbar
          key={toast.key}
          open={toast.open}
          autoHideDuration={toast.duration}
          onClose={closeToast}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: 7 }}
        >
          <Alert onClose={closeToast} severity={toast.severity} variant="filled" sx={{ width: '100%', minWidth: 320 }}>
            {toast.message}
          </Alert>
        </Snackbar>

        {/* Confirmations */}
        <Dialog open={!!dialog} onClose={() => closeDialog(false)} maxWidth="xs" fullWidth>
          {dialog?.title && <DialogTitle sx={{ fontWeight: 700 }}>{dialog.title}</DialogTitle>}
          <DialogContent>
            <Alert severity={dialog?.severity || 'warning'} variant="outlined" sx={{ whiteSpace: 'pre-line' }}>
              {dialog?.message}
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => closeDialog(false)} color="inherit">
              {dialog?.cancelText || 'Annuler'}
            </Button>
            <Button
              onClick={() => closeDialog(true)}
              variant="contained"
             color={{ error: 'error', success: 'success', warning: 'warning' }[dialog?.severity] || 'primary'}
              autoFocus
            >
              {dialog?.confirmText || 'Confirmer'}
            </Button>
          </DialogActions>
        </Dialog>
      </FeedbackContext.Provider>
    </ThemeProvider>
  )
}

export const useFeedback = () => useContext(FeedbackContext)