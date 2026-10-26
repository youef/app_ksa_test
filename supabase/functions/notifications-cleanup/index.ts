import { maintenanceHandler } from '../_shared/maintenance.ts';

Deno.serve(maintenanceHandler('notifications-cleanup'));
