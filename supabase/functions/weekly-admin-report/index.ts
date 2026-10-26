import { maintenanceHandler } from '../_shared/maintenance.ts';

Deno.serve(maintenanceHandler('weekly-admin-report'));
