import { Header } from '@/components/Header/Header'
import { KeyColorsSection } from '@/components/KeyColors/KeyColorsSection'
import styles from './App.css'

export function App() {
  return (
    <div class={styles.root}>
      <Header />
      <div class={styles.body}>
        <KeyColorsSection />
      </div>
    </div>
  )
}
