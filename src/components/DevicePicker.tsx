// Geräte-Umschaltung: listet verfügbare Wiedergabegeräte (App, Lautsprecher,
// TV, Handy) und überträgt die Wiedergabe. Öffnen/Schließen wie das Sheet:
// transform/opacity, ease-drawer.
import { useStore } from '../lib/store';
import { IconDevice, IconCheck, IconRefresh } from './icons';

export const DevicePicker = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { devices, deviceId, refreshDevices } = useStore();

  return (
    <div className={'dev-wrap' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="dev-scrim" onClick={onClose} />
      <section className={'dev-sheet' + (open ? ' open' : '')} role="dialog" aria-label="Wiedergabegerät wählen">
        <div className="dev-head">
          <h3 className="dev-title">Wiedergabe auf …</h3>
          <button className="icon-btn" onClick={() => refreshDevices()} aria-label="Geräte aktualisieren">
            <IconRefresh size={18} />
          </button>
        </div>
        <ul className="dev-list">
          {devices.map((d) => {
            const on = d.id === deviceId;
            return (
              <li key={d.id}>
                <button
                  className={'dev-item' + (on ? ' on' : '')}
                  onClick={() => {
                    void useStore.getState().switchDevice(d.id);
                    onClose();
                  }}
                  aria-pressed={on}
                >
                  <span className="dev-ic" aria-hidden>
                    <IconDevice size={20} />
                  </span>
                  <span className="dev-meta">
                    <span className="dev-name">{d.name}</span>
                    <span className="dev-type">{d.type}</span>
                  </span>
                  {on && <IconCheck size={18} />}
                </button>
              </li>
            );
          })}
          {devices.length === 0 && <li className="hint">Keine Geräte gefunden. Aktualisieren oder in der Spotify-App ein Gerät koppeln.</li>}
        </ul>
      </section>
    </div>
  );
};
