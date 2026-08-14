import { useContext } from 'react';
import { AuthAccessContext } from '../context/authAccessContext';

export function useAuthAccess() {
  return useContext(AuthAccessContext);
}
