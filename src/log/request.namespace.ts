import { createNamespace } from "cls-hooked";

const requestNamespace = createNamespace('request');

export const getTraceId = (): string => {
  const traceId = requestNamespace.get('traceId');
  return traceId ? traceId : 'N/A';
};

export const setTraceId = (traceId: string) => {
  requestNamespace.set('traceId', traceId);
};

export default requestNamespace;