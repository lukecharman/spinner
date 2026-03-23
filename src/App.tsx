import './App.css';
import { useSpinner } from './hooks/useSpinner';
import { SpinnerDisplay } from './components/SpinnerDisplay';
import { MemberManager } from './components/MemberManager';

function App() {
  const { state, available, pickNext, addMember, removeMember, resetCycle } = useSpinner();

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎡 Standup Spinner</h1>
        <p className="app-subtitle">Who's hosting today?</p>
      </header>

      <main className="app-main">
        <SpinnerDisplay
          members={state.members}
          onSpin={pickNext}
        />

        <MemberManager
          members={state.members}
          cycle={state.cycle}
          available={available}
          onAdd={addMember}
          onRemove={removeMember}
          onResetCycle={resetCycle}
        />
      </main>
    </div>
  );
}

export default App;
