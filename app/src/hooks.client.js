// Runs once in the browser: anything that crashes is recorded (see lib/errors.js).
import { reportError, watchForErrors } from '#lib/errors.js';

watchForErrors();

export function handleError({ error, status }) {
  if (status !== 404) reportError(error);
  return { message: status === 404 ? 'Page not found' : 'Something went wrong' };
}
