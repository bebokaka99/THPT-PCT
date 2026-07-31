import { findRoles } from './role.repository.js';

export async function listRoles() {
  return {
    data: await findRoles(),
  };
}
