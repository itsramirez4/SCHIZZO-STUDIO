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
  const [kelvin, setKelvin] = useState(5600);
  const [rim, setRim] = useState(0);
  const [shadows, setShadows] = useState(true);
  const [clay, setClay] = useState(false);

  useEffect(() => {
    engine?.setLighting(azimuth, elevation, intensity, ambient);
  }, [engine, azimuth, elevation, intensity, ambient]);
  useEffect(() => {
    engine?.setLightTemperature(kelvin);
  }, [engine, kelvin]);
  useEffect(() => {
    engine?.setRimLight(rim);
  }, [engine, rim]);
  useEffect(() => {
    engine?.setShadowsVisible(shadows);
  }, [engine, shadows]);
  useEffect(() => {
    engine?.setClayMode(clay);
  }, [engine, clay]);

  return (
    <div className="space-y-1">
      <NumberSlider label="Acimut" value={azimuth} min={0} max={359} onChange={setAzimuth} />
      <NumberSlider label="Elevación" value={elevation} min={5} max={90} onChange={setElevation} />
      <NumberSlider label="Intensidad" value={intensity} min={0} max={3} step={0.1} onChange={setIntensity} />
      <NumberSlider label="Ambiental" value={ambient} min={0} max={2} step={0.1} onChange={setAmbient} />
      <NumberSlider label="Temp. (K)" value={kelvin} min={2000} max={9000} step={100} onChange={setKelvin} />
      <p className="text-[9px] text-textDim">
        {kelvin < 3500 ? 'Cálida (vela/tungsteno)' : kelvin < 5000 ? 'Cálida suave (amanecer/atardecer)' : kelvin < 6500 ? 'Neutra (luz de día)' : 'Fría (sombra/cielo nublado)'}
      </p>
      <NumberSlider label="Contraluz" value={rim} min={0} max={3} step={0.1} onChange={setRim} />
      <label className="flex items-center gap-1.5 text-[10px] text-textDim">
        <input type="checkbox" checked={shadows} onChange={(e) => setShadows(e.target.checked)} /> Sombras proyectadas
      </label>
      <label className="flex items-center gap-1.5 text-[10px] text-textDim">
        <input type="checkbox" checked={clay} onChange={(e) => setClay(e.target.checked)} /> Vista de valores (arcilla gris)
      </label>
    </div>
  );
}
