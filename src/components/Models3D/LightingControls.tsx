import { useEffect, useState } from 'react';
import { Model3DViewerEngine } from '@/services/model3d.service';
import NumberSlider from './NumberSlider';

/** Azimuth/elevation "sun direction" controls instead of raw xyz — the point is letting an
 * artist see how light falls on a pose from different angles, not authoring a lighting rig. */
export default function LightingControls({ engine }: { engine: Model3DViewerEngine | null }) {
  const [azimuth, setAzimuth] = useState(45);
  const [elevation, setElevation] = useState(55);
  const [intensity, setIntensity] = useState(1.2);
  const [ambient, setAmbient] = useState(0.7);

  useEffect(() => {
    engine?.setLighting(azimuth, elevation, intensity, ambient);
  }, [engine, azimuth, elevation, intensity, ambient]);

  return (
    <div className="space-y-1">
      <NumberSlider label="Acimut" value={azimuth} min={0} max={359} onChange={setAzimuth} />
      <NumberSlider label="Elevación" value={elevation} min={5} max={90} onChange={setElevation} />
      <NumberSlider label="Intensidad" value={intensity} min={0} max={3} step={0.1} onChange={setIntensity} />
      <NumberSlider label="Ambiental" value={ambient} min={0} max={2} step={0.1} onChange={setAmbient} />
    </div>
  );
}
