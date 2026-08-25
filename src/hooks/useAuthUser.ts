import { useContext } from 'react';
import { AuthUserContext } from '../context/authUserContext';

export function useAuthUser() {
  return useContext(AuthUserContext);
}
