import './App.css';
import { useSpinner } from './hooks/useSpinner';
import { SpinnerDisplay } from './components/SpinnerDisplay';
import { MemberManager } from './components/MemberManager';

function App() {
  const {
    state, team, available, pickNext, confirmPick, skipPick,
    addMember, removeMember, resetCycle,
    setActiveTeam, addTeam, removeTeam, renameTeam,
  } = useSpinner();

  return (
    <div className="app">
      <div className="main-layout">
        <SpinnerDisplay
          members={team.members}
          onSpin={pickNext}
          onSkip={skipPick}
          onConfirm={confirmPick}
        />

        <div className="side-panel">
          <MemberManager
            members={team.members}
            cycle={team.cycle}
            available={available}
            teamOrder={state.teamOrder}
            activeTeam={state.activeTeam}
            onAdd={addMember}
            onRemove={removeMember}
            onResetCycle={resetCycle}
            onSetActiveTeam={setActiveTeam}
            onAddTeam={addTeam}
            onRemoveTeam={removeTeam}
            onRenameTeam={renameTeam}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
