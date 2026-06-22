import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { fmtKES } from "../api";

// Hardware catalogue. These are physical products sold alongside the software
// services — biometric terminals, POS peripherals and GPS trackers. Static for
// now (no backend stock); enquiries route to Contact.
const CATEGORIES = [
  {
    ico: "fingerprint",
    key: "biometrics",
    title: "Biometrics",
    blurb: "Fingerprint and facial recognition terminals for Time & Attendance and access control.",
    items: [
      { name: "Fingerprint Terminal", spec: "TCP/IP + USB · up to 3,000 prints", price: 14500, pairs: "Time & Attendance" },
      { name: "Face + Fingerprint Terminal", spec: "Facial + fingerprint · access control", price: 28000, pairs: "Time & Attendance" },
      { name: "Door Access Kit", spec: "Reader, lock & exit button", price: 19500, pairs: "HR / Access" },
    ],
  },
  {
    ico: "printer",
    key: "pos",
    title: "POS Hardware",
    blurb: "Everything to run a till: thermal printers, scanners, cash drawers and all-in-one terminals.",
    items: [
      { name: "Thermal Receipt Printer", spec: "80mm · USB + Bluetooth", price: 9500, pairs: "POS" },
      { name: "Barcode Scanner", spec: "1D/2D · wired", price: 6500, pairs: "POS / Inventory" },
      { name: "Cash Drawer", spec: "5 note / 8 coin · RJ11", price: 7000, pairs: "POS" },
      { name: "All-in-One POS Terminal", spec: "15\" touch · printer + scanner", price: 62000, pairs: "POS" },
    ],
  },
  {
    ico: "truck",
    key: "trackers",
    title: "Vehicle Tracker Hardware",
    blurb: "GPS tracking devices and accessories for real-time fleet monitoring.",
    items: [
      { name: "GPS Tracker (Wired)", spec: "Hardwired · cut-off relay support", price: 8500, pairs: "Vehicle Tracking" },
      { name: "GPS Tracker (Plug & Play)", spec: "OBD-II · self-install", price: 6000, pairs: "Vehicle Tracking" },
      { name: "Fuel Sensor Add-on", spec: "Capacitive · tank-level monitoring", price: 12000, pairs: "Vehicle Tracking" },
    ],
  },
];

export default function Hardware() {
  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Hardware</span>
            <h2>Devices that pair with our software.</h2>
            <p>Biometric terminals, POS peripherals and GPS trackers — supplied, installed and supported by Zonal Tech. Prices exclude VAT and installation; contact us for a quote.</p>
          </div>

          <div className="stack" style={{ gap: "3rem" }}>
            {CATEGORIES.map((cat) => (
              <div key={cat.key} id={cat.key}>
                <div className="hw-cat-head">
                  <div className="ico"><Icon name={cat.ico} size={22} /></div>
                  <div>
                    <h3>{cat.title}</h3>
                    <p className="muted" style={{ margin: 0 }}>{cat.blurb}</p>
                  </div>
                </div>
                <div className="grid-3">
                  {cat.items.map((it) => (
                    <article key={it.name} className="card hw-card">
                      <h4>{it.name}</h4>
                      <p className="hw-spec">{it.spec}</p>
                      <span className="badge badge-accent">Pairs with {it.pairs}</span>
                      <div className="hw-foot">
                        <div className="price">{fmtKES(it.price)} <span>/ from</span></div>
                        <Link to="/contact" className="btn btn-sm">Enquire</Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="cta-band" style={{ marginTop: "3.5rem" }}>
            <h2>Need a hardware bundle?</h2>
            <p>Tell us your setup and we'll quote the right devices, install them and pair them with your Zonal Tech software.</p>
            <Link to="/contact" className="btn btn-primary btn-lg">Request a quote</Link>
          </div>
        </div>
      </section>
    </>
  );
}
