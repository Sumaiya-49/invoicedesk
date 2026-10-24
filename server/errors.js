/** An error with an HTTP status code and a message that is safe to show the user. */
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new AppError(400, msg);
export const notFound = (what) => new AppError(404, `${what} not found`);
export const conflict = (msg) => new AppError(409, msg);

/** Lets route handlers be async: any error goes to the error handler in app.js. */
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
