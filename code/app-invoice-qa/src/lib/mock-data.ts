import "server-only";
import type { Correction, Invoice, Property } from "./types";

// In-memory stand-in for the UJ2 tables, used when QA_DATA_MODE=mock (local dev before the
// invoice tables exist, and for UI work without a warehouse). Shape = data contract.

export const MOCK_PROPERTIES: Property[] = [
  { property_id: 1, property_name: "Amstel Logistics Park", city: "Amsterdam", country: "NL" },
  { property_id: 2, property_name: "Rhine Gate Offices", city: "Frankfurt", country: "DE" },
  { property_id: 3, property_name: "Lumière Residences", city: "Lyon", country: "FR" },
  { property_id: 4, property_name: "Vltava Business Centre", city: "Prague", country: "CZ" },
  { property_id: 5, property_name: "Øresund Distribution Hub", city: "Malmö", country: "SE" },
  { property_id: 6, property_name: "Castellana Tower", city: "Madrid", country: "ES" },
  { property_id: 7, property_name: "Grand Rue Retail Quarter", city: "Luxembourg", country: "LU" },
  { property_id: 8, property_name: "Docklands Studios", city: "Dublin", country: "IE" },
  { property_id: 9, property_name: "Porta Nord Campus", city: "Milan", country: "IT" },
  { property_id: 10, property_name: "Vistula Logistics Centre", city: "Warsaw", country: "PL" },
];

type Seed = Omit<Invoice, "file_path" | "property_name" | "document_type" | "reading_type" | "validation_flags" | "peer_kwh_per_day" | "peer_count" | "extracted_at" | "reviewed_by" | "reviewed_at"> &
  Partial<Pick<Invoice, "reviewed_by" | "reviewed_at">>;

const S = (s: Seed) => s;

const SEED: Seed[] = [
  S({ invoice_id: "INV-0001", received_date: "2026-08-04", supplier_name: "Vattenfall Energie B.V.", invoice_number: "VF-2026-778120", invoice_date: "2026-08-01", billing_period_start: "2026-07-01", billing_period_end: "2026-07-31", property_id: 1, site_address: "Amstelkade 120, 1078 Amsterdam", meter_id: "NL-E-1001", utility_type: "electricity", consumption: 48210, consumption_unit: "kWh", consumption_kwh: 48210, amount_net: 11570.4, vat_amount: 2429.78, amount_total: 14000.18, currency: "EUR", qa_status: "Approved", reviewed_by: "qa.lead@revantage.example", reviewed_at: "2026-08-06T09:12:00Z" }),
  S({ invoice_id: "INV-0002", received_date: "2026-08-11", supplier_name: "E.ON Energie Deutschland GmbH", invoice_number: "EON-44817263", invoice_date: "2026-08-07", billing_period_start: "2026-07-01", billing_period_end: "2026-07-31", property_id: 2, site_address: "Mainzer Landstraße 50, 60325 Frankfurt", meter_id: "DE-E-2001", utility_type: "electricity", consumption: 61.35, consumption_unit: "MWh", consumption_kwh: 61350, amount_net: 15951.0, vat_amount: 3030.69, amount_total: 18981.69, currency: "EUR", qa_status: "Corrected", reviewed_by: "qa.lead@revantage.example", reviewed_at: "2026-08-12T14:40:00Z" }),
  S({ invoice_id: "INV-0003", received_date: "2026-08-18", supplier_name: "Engie France", invoice_number: "ENG-FR-2026-0815", invoice_date: "2026-08-14", billing_period_start: "2026-07-01", billing_period_end: "2026-07-31", property_id: 3, site_address: "12 Quai Perrache, 69002 Lyon", meter_id: "FR-G-3001", utility_type: "gas", consumption: 9340, consumption_unit: "kWh", consumption_kwh: 9340, amount_net: 1027.4, vat_amount: 205.48, amount_total: 1232.88, currency: "EUR", qa_status: "Approved", reviewed_by: "qa.lead@revantage.example", reviewed_at: "2026-08-19T10:02:00Z" }),
  S({ invoice_id: "INV-0004", received_date: "2026-09-02", supplier_name: "Pražská energetika a.s.", invoice_number: "PRE-26-0091822", invoice_date: "2026-08-29", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: 4, site_address: "Na Florenci 15, 110 00 Praha 1", meter_id: "CZ-E-4001", utility_type: "electricity", consumption: 39880, consumption_unit: "kWh", consumption_kwh: 39880, amount_net: 207376.0, vat_amount: 43548.96, amount_total: 250924.96, currency: "CZK", qa_status: "Pending" }),
  S({ invoice_id: "INV-0005", received_date: "2026-09-08", supplier_name: "E.ON Sverige AB", invoice_number: null, invoice_date: "2026-09-03", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: 5, site_address: "Hamnvägen 8, 211 20 Malmö", meter_id: "SE-DH-5001", utility_type: "district_heating", consumption: 18.6, consumption_unit: "MWh", consumption_kwh: 18600, amount_net: 15996.0, vat_amount: 3999.0, amount_total: 19995.0, currency: "SEK", qa_status: "Pending" }),
  S({ invoice_id: "INV-0006", received_date: "2026-09-15", supplier_name: "Iberdrola Clientes S.A.U.", invoice_number: "IB-2026-5521873", invoice_date: "2026-09-10", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: 6, site_address: "Paseo de la Castellana 95, 28046 Madrid", meter_id: "ES-E-6001", utility_type: "electricity", consumption: 72450, consumption_unit: "kWh", consumption_kwh: 72450, amount_net: 15214.5, vat_amount: 3195.05, amount_total: 18904.55, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0007", received_date: "2026-09-22", supplier_name: "Creos Luxembourg S.A.", invoice_number: "CR-0921-77310", invoice_date: "2026-09-18", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: null, site_address: "Grand-Rue 41, L-1661 Luxembourg", meter_id: "LU-E-7001", utility_type: "electricity", consumption: 21340, consumption_unit: "kWh", consumption_kwh: 21340, amount_net: 4695.0, vat_amount: 798.15, amount_total: 5493.15, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0008", received_date: "2026-09-29", supplier_name: "Electric Ireland", invoice_number: "EI-88120934", invoice_date: "2026-09-24", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: 8, site_address: "North Wall Quay 7, Dublin 1", meter_id: "IE-E-8001", utility_type: "electricity", consumption: 33120, consumption_unit: "kWh", consumption_kwh: 33120, amount_net: 8611.2, vat_amount: 775.01, amount_total: 9386.21, currency: "EUR", qa_status: "Approved", reviewed_by: "qa.analyst@revantage.example", reviewed_at: "2026-09-30T08:55:00Z" }),
  S({ invoice_id: "INV-0009", received_date: "2026-10-06", supplier_name: "A2A Energia S.p.A.", invoice_number: "A2A-2026-0099187", invoice_date: "2026-10-01", billing_period_start: "2026-09-01", billing_period_end: "2026-09-30", property_id: 9, site_address: "Via Galvani 24, 20124 Milano", meter_id: "IT-G-9001", utility_type: "gas", consumption: 3120, consumption_unit: "m³", consumption_kwh: 32760, amount_net: 3276.0, vat_amount: 720.72, amount_total: 3996.72, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0010", received_date: "2026-10-13", supplier_name: "MPWiK m.st. Warszawa S.A.", invoice_number: "MPWIK/2026/10/4471", invoice_date: "2026-10-08", billing_period_start: "2026-09-01", billing_period_end: "2026-09-30", property_id: 10, site_address: "ul. Annopol 3, 03-236 Warszawa", meter_id: "PL-W-10001", utility_type: "water", consumption: 412, consumption_unit: "m³", consumption_kwh: null, amount_net: 5356.0, vat_amount: 428.48, amount_total: 5784.48, currency: "PLN", qa_status: "Pending" }),
  S({ invoice_id: "INV-0011", received_date: "2026-10-20", supplier_name: "Vattenfall Energie B.V.", invoice_number: "VF-2026-801455", invoice_date: "2026-10-01", billing_period_start: "2026-09-01", billing_period_end: "2026-09-30", property_id: 1, site_address: "Amstelkade 120, 1078 Amsterdam", meter_id: "NL-E-1001", utility_type: "electricity", consumption: 481200, consumption_unit: "kWh", consumption_kwh: 481200, amount_net: 11548.8, vat_amount: 2425.25, amount_total: 13974.05, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0012", received_date: "2026-10-20", supplier_name: "Vattenfall Energie B.V.", invoice_number: "VF-2026-789002", invoice_date: "2026-09-01", billing_period_start: "2026-08-01", billing_period_end: "2026-08-31", property_id: 1, site_address: "Amstelkade 120, 1078 Amsterdam", meter_id: "NL-E-1001", utility_type: "electricity", consumption: 47120, consumption_unit: "kWh", consumption_kwh: 47120, amount_net: 11308.8, vat_amount: 2374.85, amount_total: 13683.65, currency: "EUR", qa_status: "Approved", reviewed_by: "qa.analyst@revantage.example", reviewed_at: "2026-10-21T11:20:00Z" }),
  S({ invoice_id: "INV-0013", received_date: "2026-10-27", supplier_name: "Stadtwerke Frankfurt am Main", invoice_number: "SWF-26-310077", invoice_date: "2026-10-22", billing_period_start: "2026-09-01", billing_period_end: "2026-09-30", property_id: 2, site_address: "Mainzer Landstraße 50, 60325 Frankfurt", meter_id: "DE-W-2003", utility_type: "water", consumption: 286, consumption_unit: "m³", consumption_kwh: null, amount_net: 1101.1, vat_amount: 77.08, amount_total: 1278.18, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0014", received_date: "2026-11-02", supplier_name: "Banque Générale du Luxembourg", invoice_number: null, invoice_date: null, billing_period_start: null, billing_period_end: null, property_id: null, site_address: null, meter_id: null, utility_type: null, consumption: null, consumption_unit: null, consumption_kwh: null, amount_net: null, vat_amount: null, amount_total: 5493.15, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0015", received_date: "2026-11-03", supplier_name: "Engie France", invoice_number: "ENG-FR-2026-1102", invoice_date: "2026-03-04", billing_period_start: "2026-10-01", billing_period_end: "2026-10-31", property_id: 3, site_address: "12 Quai Perrache, 69002 Lyon", meter_id: "FR-G-3001", utility_type: "gas", consumption: 15880, consumption_unit: "kWh", consumption_kwh: 15880, amount_net: 1746.8, vat_amount: 349.36, amount_total: 2096.16, currency: "EUR", qa_status: "Pending" }),
  S({ invoice_id: "INV-0016", received_date: "2026-11-04", supplier_name: "Iberdrola Clientes S.A.U.", invoice_number: "IB-2026-6000412-AB", invoice_date: "2026-10-30", billing_period_start: "2026-09-01", billing_period_end: "2026-09-30", property_id: 6, site_address: "Paseo de la Castellana 95, 28046 Madrid", meter_id: "ES-E-6001", utility_type: "electricity", consumption: -3200, consumption_unit: "kWh", consumption_kwh: -3200, amount_net: -672.0, vat_amount: -141.12, amount_total: -813.12, currency: "EUR", qa_status: "Pending" }),
];

const PROPERTY_NAME = new Map(MOCK_PROPERTIES.map((p) => [p.property_id, p.property_name]));

function hydrate(s: Seed): Invoice {
  return {
    ...s,
    file_path: `/Volumes/<catalog>/<schema>/utility_invoices/incoming/${s.received_date}/${s.invoice_id.toLowerCase()}.pdf`,
    property_name: s.property_id == null ? null : (PROPERTY_NAME.get(s.property_id) ?? null),
    extracted_at: `${s.received_date}T06:05:00Z`,
    reviewed_by: s.reviewed_by ?? null,
    reviewed_at: s.reviewed_at ?? null,
    document_type: s.invoice_id === "INV-0014" ? "reminder" : s.amount_total != null && s.amount_total < 0 ? "credit_note" : "invoice",
    reading_type: "actual",
    validation_flags: null,
    peer_kwh_per_day: null,
    peer_count: 0,
  };
}

const SEED_CORRECTIONS: Correction[] = [
  { correction_id: "c-0001", invoice_id: "INV-0002", field_name: "consumption_kwh", extracted_value: "61.35", corrected_value: "61350", error_type: "unit", comment: "MWh read as kWh", corrected_by: "qa.lead@revantage.example", corrected_at: "2026-08-12T14:40:00Z" },
];

type Store = { invoices: Invoice[]; corrections: Correction[] };
const g = globalThis as unknown as { __qaMockStore?: Store };

export function mockStore(): Store {
  g.__qaMockStore ??= { invoices: SEED.map(hydrate), corrections: SEED_CORRECTIONS.map((c) => ({ ...c })) };
  return g.__qaMockStore;
}

export function resetMockStore() {
  g.__qaMockStore = undefined;
}
