import { HttpInterceptorFn } from '@angular/common/http';

export const externalApiInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
