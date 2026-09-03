import { pool } from './index';

export async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('Seeding demo database data...');
    await client.query('BEGIN');

    const profiles = [
      // 1. Executive / C-Suite (Top Level)
      { id: '55555555-5555-5555-5555-555555555555', email: 'approver3@example.com', role: 'approver', approval_limit: 500000.00, title: 'Executive VP of Procurement', department: 'Executive', reports_to_id: null },
      { id: '66666666-6666-6666-6666-666666666666', email: 'cfo@example.com', role: 'approver', approval_limit: 1000000.00, title: 'Chief Financial Officer (CFO)', department: 'Executive', reports_to_id: null },

      // 2. Operations Department
      { id: '44444444-4444-4444-4444-444444444444', email: 'approver2@example.com', role: 'approver', approval_limit: 50000.00, title: 'Senior Operations Director', department: 'Operations', reports_to_id: '55555555-5555-5555-5555-555555555555' },
      { id: '77777777-7777-7777-7777-777777777777', email: 'ops_manager@example.com', role: 'approver', approval_limit: 15000.00, title: 'Operations Floor Manager', department: 'Operations', reports_to_id: '44444444-4444-4444-4444-444444444444' },
      { id: '11111111-1111-1111-1111-111111111111', email: 'requester@example.com', role: 'requester', approval_limit: null, title: 'Operations Lead Requester', department: 'Operations', reports_to_id: '77777777-7777-7777-7777-777777777777' },
      { id: '12121212-1212-1212-1212-121212121212', email: 'ops_analyst@example.com', role: 'requester', approval_limit: null, title: 'Supply Chain Analyst', department: 'Operations', reports_to_id: '77777777-7777-7777-7777-777777777777' },

      // 3. Engineering Department
      { id: '88888888-8888-8888-8888-888888888888', email: 'eng_director@example.com', role: 'approver', approval_limit: 100000.00, title: 'VP of Engineering', department: 'Engineering', reports_to_id: '66666666-6666-6666-6666-666666666666' },
      { id: '99999999-9999-9999-9999-999999999999', email: 'eng_manager@example.com', role: 'approver', approval_limit: 20000.00, title: 'Engineering Manager', department: 'Engineering', reports_to_id: '88888888-8888-8888-8888-888888888888' },
      { id: '33333333-3333-3333-3333-333333333333', email: 'approver1@example.com', role: 'approver', approval_limit: 1000.00, title: 'Junior Engineering Approver', department: 'Engineering', reports_to_id: '99999999-9999-9999-9999-999999999999' },
      { id: '13131313-1313-1313-1313-131313131313', email: 'dev_lead@example.com', role: 'requester', approval_limit: null, title: 'Senior Systems Engineer', department: 'Engineering', reports_to_id: '33333333-3333-3333-3333-333333333333' },
      { id: '14141414-1414-1414-1414-141414141414', email: 'qa_lead@example.com', role: 'requester', approval_limit: null, title: 'QA Automation Lead', department: 'Engineering', reports_to_id: '33333333-3333-3333-3333-333333333333' },

      // 4. Safety & Facilities Department
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'safety_director@example.com', role: 'approver', approval_limit: 35000.00, title: 'Director of Safety & EHS', department: 'Safety', reports_to_id: '55555555-5555-5555-5555-555555555555' },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'safety_supervisor@example.com', role: 'approver', approval_limit: 5000.00, title: 'Site Safety Supervisor', department: 'Safety', reports_to_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      { id: '22222222-2222-2222-2222-222222222222', email: 'requester2@example.com', role: 'requester', approval_limit: null, title: 'Senior Maintenance Tech', department: 'Maintenance', reports_to_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      { id: '15151515-1515-1515-1515-151515151515', email: 'facilities_coord@example.com', role: 'requester', approval_limit: null, title: 'Facilities Operations Specialist', department: 'Maintenance', reports_to_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },

      // 5. IT & Cloud Department
      { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'it_director@example.com', role: 'approver', approval_limit: 75000.00, title: 'Director of IT Systems', department: 'IT', reports_to_id: '66666666-6666-6666-6666-666666666666' },
      { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', email: 'cloud_lead@example.com', role: 'approver', approval_limit: 8000.00, title: 'Cloud Infrastructure Approver', department: 'IT', reports_to_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      { id: '16161616-1616-1616-1616-161616161616', email: 'devops_eng@example.com', role: 'requester', approval_limit: null, title: 'Cloud DevOps Engineer', department: 'IT', reports_to_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
    ];

    const checkAuthUsers = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'auth' AND table_name = 'users'
      ) as exists
    `);

    if (checkAuthUsers.rows[0]?.exists) {
      for (const p of profiles) {
        await client.query(
          `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
           VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '$2a$10$w095H8w.XG3x0.qjXJ.Y6.XkXj/G/X.XkXj/G/X.XkXj/G', NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [p.id, p.email]
        );
      }
    }

    // Step 1: Insert all profiles with reports_to_id = null first to satisfy any foreign keys
    for (const p of profiles) {
      await client.query(
        `INSERT INTO profiles (id, email, role, approval_limit, title, department, reports_to_id)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)
         ON CONFLICT (id) DO UPDATE SET 
           email = EXCLUDED.email, role = EXCLUDED.role, approval_limit = EXCLUDED.approval_limit,
           title = EXCLUDED.title, department = EXCLUDED.department`,
        [p.id, p.email, p.role, p.approval_limit, p.title, p.department]
      );
    }

    // Step 2: Update actual hierarchy reports_to_id
    for (const p of profiles) {
      if (p.reports_to_id) {
        await client.query(
          `UPDATE profiles SET reports_to_id = $1 WHERE id = $2`,
          [p.reports_to_id, p.id]
        );
      }
    }

    const reqs = [
      {
        id: 'a1111111-1111-1111-1111-111111111111',
        owner_id: '11111111-1111-1111-1111-111111111111',
        title: 'Office Ergonomic Chairs & Desks',
        vendor_name: 'Herman Miller Inc.',
        department: 'Operations',
        needed_by: '2026-09-15',
        status: 'Draft',
        lines: [{ description: 'Aeron Ergonomic Desk Chair', qty: 2, price: 450.00, rcv: 0 }],
      },
      {
        id: 'a2222222-2222-2222-2222-222222222222',
        owner_id: '13131313-1313-1313-1313-131313131313',
        title: 'CNC Machine Replacement Filters',
        vendor_name: 'Grainger Supply',
        department: 'Engineering',
        needed_by: '2026-09-10',
        status: 'Submitted',
        lines: [
          { description: 'HEPA Air Filter Module', qty: 5, price: 120.00, rcv: 0 },
          { description: 'Coolant Hose Assembly', qty: 2, price: 85.00, rcv: 0 },
        ],
      },
      {
        id: 'a3333333-3333-3333-3333-333333333333',
        owner_id: '13131313-1313-1313-1313-131313131313',
        title: 'Enterprise Server Upgrade Kits',
        vendor_name: 'Dell Technologies',
        department: 'Engineering',
        needed_by: '2026-09-01',
        status: 'Submitted',
        lines: [{ description: 'PowerEdge R750 Server Kit', qty: 3, price: 4200.00, rcv: 0 }],
      },
      {
        id: 'a4444444-4444-4444-4444-444444444444',
        owner_id: '22222222-2222-2222-2222-222222222222',
        title: 'Safety Helmets & Kevlar Gloves',
        vendor_name: '3M Industrial Supply',
        department: 'Safety',
        needed_by: '2026-08-20',
        status: 'Ordered',
        lines: [
          { description: 'Hard Hat ANSI Certified Type II', qty: 20, price: 25.00, rcv: 10 },
          { description: 'Kevlar Cut-Resistant Gloves', qty: 30, price: 15.00, rcv: 15 },
        ],
      },
      {
        id: 'a5555555-5555-5555-5555-555555555555',
        owner_id: '15151515-1515-1515-1515-151515151515',
        title: 'Quarterly Synthetic Lubricant Oils',
        vendor_name: 'Mobil Oil Corp',
        department: 'Maintenance',
        needed_by: '2026-08-28',
        status: 'Received',
        lines: [{ description: 'Synthetic Gear Oil 55 Gal Drum', qty: 2, price: 800.00, rcv: 2 }],
      },
      {
        id: 'a6666666-6666-6666-6666-666666666666',
        owner_id: '14141414-1414-1414-1414-141414141414',
        title: 'CAD Engineering Workstations',
        vendor_name: 'Apple Inc.',
        department: 'Engineering',
        needed_by: '2026-09-25',
        status: 'Submitted',
        lines: [
          { description: 'Mac Studio M2 Ultra 64GB', qty: 2, price: 3999.00, rcv: 0 },
          { description: 'Studio Display 27-inch 5K Retina', qty: 2, price: 1599.00, rcv: 0 },
        ],
      },
      {
        id: 'a7777777-7777-7777-7777-777777777777',
        owner_id: '16161616-1616-1616-1616-161616161616',
        title: 'DevOps APM Monitoring Licenses',
        vendor_name: 'Datadog & HashiCorp',
        department: 'IT',
        needed_by: '2026-09-18',
        status: 'Approved',
        lines: [{ description: 'APM Pro Annual License Tier', qty: 10, price: 240.00, rcv: 0 }],
      },
      {
        id: 'a8888888-8888-8888-8888-888888888888',
        owner_id: '14141414-1414-1414-1414-141414141414',
        title: 'Lab Spectrometer Calibration Visit',
        vendor_name: 'Thermo Fisher Scientific',
        department: 'Engineering',
        needed_by: '2026-09-05',
        status: 'Rejected',
        lines: [{ description: 'Annual Precision Calibration Service', qty: 1, price: 850.00, rcv: 0 }],
      },
      {
        id: 'a9999999-9999-9999-9999-999999999999',
        owner_id: '12121212-1212-1212-1212-121212121212',
        title: 'Warehouse Barcode Scanners & Printers',
        vendor_name: 'Zebra Technologies',
        department: 'Operations',
        needed_by: '2026-09-12',
        status: 'Submitted',
        lines: [
          { description: 'Industrial Handheld Barcode Scanner', qty: 4, price: 320.00, rcv: 0 },
          { description: 'Direct Thermal Label Printer', qty: 2, price: 480.00, rcv: 0 },
        ],
      },
      {
        id: 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        owner_id: '16161616-1616-1616-1616-161616161616',
        title: 'AWS Cloud Reserved Instances',
        vendor_name: 'Amazon Web Services',
        department: 'IT',
        needed_by: '2026-10-01',
        status: 'Submitted',
        lines: [{ description: 'EC2 Compute Savings Plan 1-Year', qty: 1, price: 5400.00, rcv: 0 }],
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbba',
        owner_id: '15151515-1515-1515-1515-151515151515',
        title: 'HVAC Air Handler Filter Replacements',
        vendor_name: 'Carrier HVAC Supplies',
        department: 'Maintenance',
        needed_by: '2026-09-22',
        status: 'Draft',
        lines: [{ description: 'MERV 13 Commercial Filter Pack', qty: 12, price: 45.00, rcv: 0 }],
      },
    ];

    for (const r of reqs) {
      await client.query(
        `INSERT INTO requisitions (id, owner_id, title, vendor_name, department, needed_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET 
           title = EXCLUDED.title, vendor_name = EXCLUDED.vendor_name,
           department = EXCLUDED.department, needed_by = EXCLUDED.needed_by, status = EXCLUDED.status`,
        [r.id, r.owner_id, r.title, r.vendor_name, r.department, r.needed_by, r.status]
      );

      // Clean existing line items to prevent duplicates on re-seed
      await client.query(`DELETE FROM line_items WHERE requisition_id = $1`, [r.id]);

      for (const line of r.lines) {
        await client.query(
          `INSERT INTO line_items (requisition_id, description, ordered_quantity, unit_price, received_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [r.id, line.description, line.qty, line.price, line.rcv]
        );
      }

      if (r.status === 'Ordered' || r.status === 'Submitted') {
        await client.query(
          `INSERT INTO requisition_assigned_approvers (requisition_id, approver_id)
           VALUES ($1, $2), ($1, $3)
           ON CONFLICT DO NOTHING`,
          [r.id, '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']
        );
      }

      await client.query(
        `INSERT INTO requisition_history (requisition_id, event_type, actor_id, new_status)
         VALUES ($1, 'created', $2, 'Draft')`,
        [r.id, r.owner_id]
      );

      if (r.status !== 'Draft') {
        await client.query(
          `INSERT INTO requisition_history (requisition_id, event_type, actor_id, old_status, new_status)
           VALUES ($1, 'status_change', $2, 'Draft', 'Submitted')`,
          [r.id, r.owner_id]
        );
      }
      if (r.status === 'Approved' || r.status === 'Ordered' || r.status === 'Received') {
        await client.query(
          `INSERT INTO requisition_history (requisition_id, event_type, actor_id, old_status, new_status)
           VALUES ($1, 'status_change', $2, 'Submitted', 'Approved')`,
          [r.id, '44444444-4444-4444-4444-444444444444']
        );
      }
      if (r.status === 'Rejected') {
        await client.query(
          `INSERT INTO requisition_history (requisition_id, event_type, actor_id, old_status, new_status, reason)
           VALUES ($1, 'status_change', $2, 'Submitted', 'Rejected', 'Exceeds current department budget cap for Q3. Please adjust the service scope.')`,
          [r.id, '33333333-3333-3333-3333-333333333333']
        );
      }
      if (r.status === 'Ordered' || r.status === 'Received') {
        await client.query(
          `INSERT INTO requisition_history (requisition_id, event_type, actor_id, old_status, new_status)
           VALUES ($1, 'status_change', $2, 'Approved', 'Ordered')`,
          [r.id, '44444444-4444-4444-4444-444444444444']
        );
      }
      if (r.status === 'Received') {
        await client.query(
          `INSERT INTO requisition_history (requisition_id, event_type, actor_id, old_status, new_status)
           VALUES ($1, 'status_change', $2, 'Ordered', 'Received')`,
          [r.id, '44444444-4444-4444-4444-444444444444']
        );
      }
    }

    await client.query('COMMIT');
    console.log('Database seeding completed successfully with multi-tier sample records.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
