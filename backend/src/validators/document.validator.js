import { z } from 'zod';
import { objectId } from './project.validator.js';

export const documentIdParams = z.object({ id: objectId('document id') });
