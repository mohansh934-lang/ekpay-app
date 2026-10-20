"use client";

import { Icon } from "@/components/Icon";
import { useEk } from "@/context/EkContext";

export function PayScreen() {
  const {
    contacts,
    setNumModal,
    setNumInput,
    setPayToIdx,
    setPayAmt,
    go,
    pickContact,
  } = useEk();

  return (
    <>
      <div className="qa" style={{ marginBottom: 10 }}>
        <button onClick={() => { setNumInput(""); setNumModal("mobile"); }}><span className="it"><Icon n="phone" /></span>Mobile</button>
        <button onClick={() => { setNumInput(""); setNumModal("upi"); }}><span className="it"><Icon n="at" /></span>UPI ID</button>
        <button onClick={() => { setNumInput(""); setNumModal("bank"); }}><span className="it"><Icon n="bank" /></span>Bank A/C</button>
        <button onClick={() => setNumModal("self")}><span className="it"><Icon n="up" /></span>Self Xfer</button>
      </div>
      {/* Contact Picker — phone ki contact list se pick karo (Android Chrome) */}
      {"contacts" in navigator && (
        <button className="btn o" style={{ marginBottom: 10, fontSize: 12.5 }} onClick={() => pickContact()}>
          📱 Pick from Phone Contacts
        </button>
      )}
      <h3>Verified Contacts</h3>
      <div className="c">
        {contacts.map((c, i) => (
          <button
            key={i}
            className="row"
            onClick={() => {
              setPayToIdx(i);
              setPayAmt("");
              go("chat");
            }}
          >
            <span className="av" style={{ background: "#fce7f0", color: "#9d1048" }}>{c[0][0]}</span>
            <span className="m">
              <b>{c[0]}</b>
              <small>{c[1]} • {c[2]}</small>
            </span>
            <span className="mu">Pay →</span>
          </button>
        ))}
      </div>
    </>
  );
}
