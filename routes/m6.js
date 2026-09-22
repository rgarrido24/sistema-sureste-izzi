import M6Master from '../models/M6Master.js';
import M5Master from '../models/M5Master.js';
import M4Master from '../models/M4Master.js';
import M3Master from '../models/M3Master.js';
import M2Master from '../models/M2Master.js';
import M1Master from '../models/M1Master.js';
import OperacionDia from '../models/OperacionDia.js';
import { createPermanenciaMnRouter } from './createPermanenciaMnRouter.js';

export default createPermanenciaMnRouter({
  moduleKey: 'm6',
  Model: M6Master,
  priorLookups: [
    { key: 'm5', model: M5Master },
    { key: 'm4', model: M4Master },
    { key: 'm3', model: M3Master },
    { key: 'm2', model: M2Master },
    { key: 'm1', model: M1Master },
    { key: 'operacion', model: OperacionDia },
  ],
});
