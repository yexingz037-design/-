import { useCallback, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { HideoutHub } from './components/HideoutHub';
import { RaidSummaryModal } from './components/RaidSummaryModal';
import { RaidView } from './components/RaidView';
import { TitleScreen } from './components/TitleScreen';
import {
  applyRaidOutcome,
  getDeploymentCost,
  loadProfile,
  resetProfile,
  saveProfile,
} from './storage/profileStore';
import { GameScreen, PlayerProfile, RaidOutcome } from './types/game';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [lastOutcome, setLastOutcome] = useState<RaidOutcome | null>(null);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [raidSessionKey, setRaidSessionKey] = useState(0);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  const handleUpdateProfile = useCallback((next: PlayerProfile) => {
    setProfile(next);
  }, []);

  const handleDeploy = useCallback(() => {
    const cost = getDeploymentCost(profile);
    if (profile.credits < cost) {
      setScreen('HIDEOUT_LOADOUT');
      return;
    }
    const next = { ...profile, credits: profile.credits - cost };
    saveProfile(next);
    setProfile(next);
    setLastOutcome(null);
    setRaidSessionKey((k) => k + 1);
    setScreen('PLAYING');
  }, [profile]);

  const handleRaidEnd = useCallback(
    (outcome: RaidOutcome) => {
      setProfile((curr) => applyRaidOutcome(curr, outcome));
      setLastOutcome(outcome);
      setScreen('RAID_SUMMARY');
    },
    []
  );

  const handleResetProfile = useCallback(() => {
    const fresh = resetProfile();
    setProfile(fresh);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0B0F17]">
      {screen === 'TITLE_MENU' && (
        <TitleScreen
          onStart={() => setScreen('HIDEOUT_LOADOUT')}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {screen === 'HIDEOUT_LOADOUT' && (
        <HideoutHub
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          onDeploy={handleDeploy}
          onResetProfile={handleResetProfile}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {(screen === 'PLAYING' || screen === 'RAID_SUMMARY') && (
        <RaidView
          key={raidSessionKey}
          loadout={profile.loadout}
          initialWeaponDurability={profile.weaponDurability?.[profile.loadout.weaponId] ?? 100}
          gearCooldowns={profile.gearCooldowns}
          muted={muted}
          onToggleMute={handleToggleMute}
          onRaidEnd={handleRaidEnd}
        />
      )}

      {screen === 'RAID_SUMMARY' && lastOutcome && (
        <RaidSummaryModal
          outcome={lastOutcome}
          profile={profile}
          onReturnBase={() => setScreen('HIDEOUT_LOADOUT')}
          onRedeploy={handleDeploy}
        />
      )}
    </div>
  );
}
