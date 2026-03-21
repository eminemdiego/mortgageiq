# Portfolio Manager — Supabase Setup

Run the following SQL in the Supabase SQL editor to create the `properties` table and enable Row Level Security.

```sql
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  -- Property
  address TEXT,
  postcode TEXT,
  property_type TEXT DEFAULT 'House',
  bedrooms INTEGER DEFAULT 1,
  estimated_value NUMERIC DEFAULT 0,
  purchase_price NUMERIC DEFAULT 0,
  purchase_date TEXT,
  -- Mortgage
  outstanding_balance NUMERIC DEFAULT 0,
  interest_rate NUMERIC DEFAULT 0,
  rate_type TEXT DEFAULT 'Fixed',
  fixed_until TEXT,
  monthly_payment NUMERIC DEFAULT 0,
  remaining_years NUMERIC DEFAULT 0,
  mortgage_type TEXT DEFAULT 'Repayment',
  lender TEXT,
  erc_percentage NUMERIC,
  -- Tenancy
  monthly_rent NUMERIC DEFAULT 0,
  tenancy_start TEXT,
  tenancy_end TEXT,
  tenant_name TEXT,
  deposit_amount NUMERIC DEFAULT 0,
  is_tenanted BOOLEAN DEFAULT true,
  -- Agent & fees (monthly £)
  agent_name TEXT,
  management_fee_pct NUMERIC DEFAULT 0,
  tenant_find_fee NUMERIC DEFAULT 0,
  -- Running costs (monthly £)
  buildings_insurance NUMERIC DEFAULT 0,
  landlord_insurance NUMERIC DEFAULT 0,
  ground_rent NUMERIC DEFAULT 0,
  service_charge NUMERIC DEFAULT 0,
  maintenance_reserve NUMERIC DEFAULT 50,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own properties"
  ON properties FOR ALL
  USING (user_id = auth.uid()::text);
```
