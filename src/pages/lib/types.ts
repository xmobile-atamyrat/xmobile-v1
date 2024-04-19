export interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}
