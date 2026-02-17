
import { AppProvider } from './context/AppContext';
import { NavigationProvider } from './context/NavigationContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { AppContent } from './components/AppContent';
import './App.css';

function App() {
  return (
    <AppProvider>
      <NavigationProvider>
        <AnalysisProvider>
          <AppContent />
        </AnalysisProvider>
      </NavigationProvider>
    </AppProvider>
  );
}

export default App;
