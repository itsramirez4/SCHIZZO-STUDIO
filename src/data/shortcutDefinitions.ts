import { ShortcutDefinition } from '@/types/shortcuts';
import { ToolType } from '@/types';

/** Which ToolType each `tool.*` action id activates — the exact same mapping the old
 * `SHORTCUT_TOOLS` object in App.tsx used, just keyed by action id instead of by key character. */
export const TOOL_SHORTCUT_ACTIONS: Record<string, ToolType> = {
  'tool.brush': 'brush',
  'tool.eraser': 'eraser',
  'tool.selection': 'selection',
  'tool.lasso': 'lasso',
  'tool.magicWand': 'magicWand',
  'tool.paintbucket': 'paintbucket',
  'tool.gradient': 'gradient',
  'tool.text': 'text',
  'tool.eyedropper': 'eyedropper',
  'tool.pen': 'pen',
  'tool.shapeRect': 'shapeRect',
  'tool.shapeEllipse': 'shapeEllipse',
  'tool.shapePolygon': 'shapePolygon',
  'tool.shapeStar': 'shapeStar',
  'tool.vectorText': 'vectorText',
  'tool.transform': 'transform',
  'tool.zoom': 'zoom',
  'tool.pan': 'pan',
  'tool.warp': 'warp',
  'tool.smudge': 'smudge',
  'tool.line': 'line',
  'tool.curve': 'curve',
};

/**
 * The full, exact set of shortcuts App.tsx's keydown handler used to hardcode — every one of
 * these 27 entries corresponds 1:1 to a branch that existed before this round, including which
 * ones called preventDefault and which required an open project. This file is data only; the
 * actual callback for each id is wired up in App.tsx, which is where the real store actions live.
 */
export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // Herramientas
  { id: 'tool.brush', label: 'Pincel', category: 'Herramientas', defaultKey: 'b', defaultModifiers: [], preventDefault: false },
  { id: 'tool.eraser', label: 'Borrador', category: 'Herramientas', defaultKey: 'e', defaultModifiers: [], preventDefault: false },
  { id: 'tool.selection', label: 'Selección', category: 'Herramientas', defaultKey: 'm', defaultModifiers: [], preventDefault: false },
  { id: 'tool.lasso', label: 'Lazo', category: 'Herramientas', defaultKey: 'l', defaultModifiers: [], preventDefault: false },
  { id: 'tool.magicWand', label: 'Varita mágica', category: 'Herramientas', defaultKey: 'w', defaultModifiers: [], preventDefault: false },
  { id: 'tool.paintbucket', label: 'Bote de pintura', category: 'Herramientas', defaultKey: 'g', defaultModifiers: [], preventDefault: false },
  { id: 'tool.gradient', label: 'Degradado', category: 'Herramientas', defaultKey: 'y', defaultModifiers: [], preventDefault: false },
  { id: 'tool.text', label: 'Texto', category: 'Herramientas', defaultKey: 't', defaultModifiers: [], preventDefault: false },
  { id: 'tool.eyedropper', label: 'Gotero', category: 'Herramientas', defaultKey: 'i', defaultModifiers: [], preventDefault: false },
  { id: 'tool.pen', label: 'Pluma', category: 'Herramientas', defaultKey: 'p', defaultModifiers: [], preventDefault: false },
  { id: 'tool.shapeRect', label: 'Rectángulo', category: 'Herramientas', defaultKey: 'r', defaultModifiers: [], preventDefault: false },
  { id: 'tool.shapeEllipse', label: 'Elipse', category: 'Herramientas', defaultKey: 'o', defaultModifiers: [], preventDefault: false },
  { id: 'tool.shapePolygon', label: 'Polígono', category: 'Herramientas', defaultKey: 'k', defaultModifiers: [], preventDefault: false },
  { id: 'tool.shapeStar', label: 'Estrella', category: 'Herramientas', defaultKey: 's', defaultModifiers: [], preventDefault: false },
  { id: 'tool.vectorText', label: 'Texto vectorial', category: 'Herramientas', defaultKey: 'u', defaultModifiers: [], preventDefault: false },
  { id: 'tool.transform', label: 'Transformar', category: 'Herramientas', defaultKey: 'v', defaultModifiers: [], preventDefault: false },
  { id: 'tool.zoom', label: 'Zoom', category: 'Herramientas', defaultKey: 'z', defaultModifiers: [], preventDefault: false },
  { id: 'tool.pan', label: 'Mano', category: 'Herramientas', defaultKey: 'h', defaultModifiers: [], preventDefault: false },
  { id: 'tool.warp', label: 'Deformar (liquify)', category: 'Herramientas', defaultKey: 'j', defaultModifiers: [], preventDefault: false },
  { id: 'tool.smudge', label: 'Mezclador de color', category: 'Herramientas', defaultKey: 'n', defaultModifiers: [], preventDefault: false },
  { id: 'tool.line', label: 'Línea recta', category: 'Herramientas', defaultKey: 'q', defaultModifiers: [], preventDefault: false },
  { id: 'tool.curve', label: 'Curva', category: 'Herramientas', defaultKey: 'c', defaultModifiers: [], preventDefault: false },

  // Pincel / color — X e D calcan la convención exacta de Photoshop (X intercambia,
  // D restablece a blanco y negro), en vez del mapeo anterior (D intercambiaba).
  { id: 'tool.swapColors', label: 'Intercambiar colores', category: 'Pincel', defaultKey: 'x', defaultModifiers: [], preventDefault: false },
  { id: 'tool.resetColors', label: 'Restablecer colores (blanco y negro)', category: 'Pincel', defaultKey: 'd', defaultModifiers: [], preventDefault: false },
  { id: 'brush.decreaseSize', label: 'Reducir tamaño de pincel', category: 'Pincel', defaultKey: '[', defaultModifiers: [], preventDefault: false },
  { id: 'brush.increaseSize', label: 'Aumentar tamaño de pincel', category: 'Pincel', defaultKey: ']', defaultModifiers: [], preventDefault: false },

  // Edición
  { id: 'edit.undo', label: 'Deshacer', category: 'Edición', defaultKey: 'z', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.redo', label: 'Rehacer', category: 'Edición', defaultKey: 'z', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'edit.fillPrimary', label: 'Rellenar con color primario', category: 'Edición', defaultKey: 'backspace', defaultModifiers: ['alt'], preventDefault: true },
  { id: 'edit.fillSecondary', label: 'Rellenar con color secundario', category: 'Edición', defaultKey: 'backspace', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.copy', label: 'Copiar selección', category: 'Edición', defaultKey: 'c', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.cut', label: 'Cortar selección', category: 'Edición', defaultKey: 'x', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.paste', label: 'Pegar', category: 'Edición', defaultKey: 'v', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'layer.duplicate', label: 'Duplicar capa', category: 'Edición', defaultKey: 'j', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'layer.invertColors', label: 'Invertir colores de la capa', category: 'Edición', defaultKey: 'i', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'layer.desaturate', label: 'Desaturar capa', category: 'Edición', defaultKey: 'u', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'edit.freeTransform', label: 'Transformación libre', category: 'Edición', defaultKey: 't', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.deselect', label: 'Deseleccionar', category: 'Edición', defaultKey: 'd', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.selectAll', label: 'Seleccionar todo', category: 'Edición', defaultKey: 'a', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'edit.invertSelection', label: 'Invertir selección', category: 'Edición', defaultKey: 'i', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'edit.copyMerged', label: 'Copiar combinado (todas las capas visibles)', category: 'Edición', defaultKey: 'c', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },

  // Capas
  { id: 'layer.new', label: 'Nueva capa', category: 'Capas', defaultKey: 'n', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'layer.group', label: 'Agrupar capas seleccionadas', category: 'Capas', defaultKey: 'g', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'layer.ungroup', label: 'Desagrupar', category: 'Capas', defaultKey: 'g', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'layer.mergeDown', label: 'Combinar hacia abajo', category: 'Capas', defaultKey: 'e', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'layer.mergeVisible', label: 'Combinar visibles', category: 'Capas', defaultKey: 'e', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },

  // Archivo
  { id: 'file.save', label: 'Guardar', category: 'Archivo', defaultKey: 's', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'file.saveAs', label: 'Guardar como', category: 'Archivo', defaultKey: 's', defaultModifiers: ['ctrl', 'shift'], preventDefault: true },
  { id: 'file.new', label: 'Nuevo proyecto', category: 'Archivo', defaultKey: 'n', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'file.open', label: 'Abrir proyecto', category: 'Archivo', defaultKey: 'o', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'file.export', label: 'Exportar', category: 'Archivo', defaultKey: 'e', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'file.imageSize', label: 'Tamaño de imagen (redimensionar)', category: 'Archivo', defaultKey: 'i', defaultModifiers: ['ctrl', 'alt'], preventDefault: true },

  // Vista
  { id: 'view.toggleGrid', label: 'Alternar grilla', category: 'Vista', defaultKey: "'", defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'view.toggleRulers', label: 'Alternar reglas', category: 'Vista', defaultKey: 'r', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'view.zoom100', label: 'Zoom al 100%', category: 'Vista', defaultKey: '1', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'view.zoomIn', label: 'Acercar zoom', category: 'Vista', defaultKey: '=', defaultModifiers: ['ctrl'], preventDefault: true },
  { id: 'view.zoomOut', label: 'Alejar zoom', category: 'Vista', defaultKey: '-', defaultModifiers: ['ctrl'], preventDefault: true },

  // Paneles
  { id: 'panel.toggleLayers', label: 'Alternar panel de capas', category: 'Paneles', defaultKey: 'f7', defaultModifiers: [], preventDefault: true },
  { id: 'panel.toggleBrushes', label: 'Alternar editor de pinceles', category: 'Paneles', defaultKey: 'f5', defaultModifiers: [], preventDefault: true },
];
