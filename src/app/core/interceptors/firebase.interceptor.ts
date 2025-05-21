import { HttpInterceptorFn } from '@angular/common/http';

export const firebaseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
