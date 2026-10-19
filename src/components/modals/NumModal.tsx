"use client";

import { inr } from "@/lib/format";
import { useEk } from "@/context/EkContext";

export function NumModal() {
  const {
    accountIds,
    curPin,
    setCurPin,
    pinTask,
    setPinTask,
    contacts,
    setContacts,
    banks,
    numModal,
    setNumModal,
    numInput,
    setNumInput,
    selfFrom,
    setSelfFrom,
    selfTo,
    setSelfTo,
    selfAmt,
    setSelfAmt,
    setPayToIdx,
    setPayAmt,
    showToast,
    go,
    newKey,
    apiCall,
    act,
    payDone,
  } = useEk();
  if (!numModal) return null;

  return (
    <div id="sh">
      <div className="sb">
        {numModal === "self" ? (
          <>
            <b style={{ fontSize: 16 }}>Self Account Transfer</b>
            <p className="mu">Instant zero-fee transfer between your own linked banks</p>
            <small style={{ display: "block", marginTop: 10 }}>From Bank</small>
            <button className="row" onClick={() => setSelfFrom((selfFrom + 1) % banks.length)}>
              <b>{banks[selfFrom][0]} ({inr(banks[selfFrom][1])})</b>
              <small style={{ color: "var(--pr)" }}>Switch</small>
            </button>
            <small style={{ display: "block", marginTop: 6 }}>To Bank</small>
            <button className="row" onClick={() => setSelfTo((selfTo + 1) % banks.length)}>
              <b>{banks[selfTo][0]} ({inr(banks[selfTo][1])})</b>
              <small style={{ color: "var(--pr)" }}>Switch</small>
            </button>
            <input type="number" value={selfAmt} onChange={(e) => setSelfAmt(e.target.value)} placeholder="Amount" />
            <button
              className="btn"
              onClick={() => {
                const a = Number(selfAmt);
                if (selfFrom === selfTo) return showToast("Select different banks");
                if (!a || banks[selfFrom][1] < a) return showToast("Insufficient balance");
                act(async () => {
                  const r = await apiCall("POST", "/api/transfers/self", {
                    fromAccountId: accountIds[selfFrom], toAccountId: accountIds[selfTo], amount: a, idempotencyKey: newKey(),
                  });
                  if (!r.ok) return showToast(r.message);
                  await payDone("Self Transfer Complete", `${inr(a)} moved from ${banks[selfFrom][0]} to ${banks[selfTo][0]}`);
                  setNumModal(null);
                });
              }}
            >
              Transfer Now
            </button>
            <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
          </>
        ) : numModal === "confirmpin" && pinTask ? (
          <>
            <b style={{ fontSize: 16 }}>{pinTask.label}</b>
            <h2 style={{ margin: "6px 0" }}>{inr(pinTask.amount)}</h2>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4-digit UPI PIN"
              maxLength={4}
              value={curPin}
              onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="btn"
              onClick={() => {
                if (curPin.length !== 4) return showToast("Enter 4 digits");
                act(async () => {
                  const r = await pinTask.run(curPin);
                  setCurPin("");
                  if (!r.ok) return showToast(r.message);
                  setNumModal(null);
                  setPinTask(null);
                });
              }}
            >
              Confirm
            </button>
            <button className="btn o" onClick={() => { setNumModal(null); setPinTask(null); setCurPin(""); }}>Cancel</button>
          </>
        ) : numModal === "changepin" ? (
          <>
            <b style={{ fontSize: 16 }}>Change 4-Digit UPI PIN</b>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Current UPI PIN"
              maxLength={4}
              value={curPin}
              onChange={(e) => setCurPin(e.target.value.replace(/\D/g, ""))}
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter new 4-digit UPI PIN"
              maxLength={4}
              value={numInput}
              onChange={(e) => setNumInput(e.target.value.replace(/\D/g, ""))}
            />
            <button
              className="btn"
              onClick={async () => {
                if (curPin.length !== 4 || numInput.length !== 4) return showToast("Enter 4 digits");
                const r = await apiCall("POST", "/api/auth/change-pin", { currentPin: curPin, newPin: numInput });
                if (!r.ok) return showToast(r.message);
                setCurPin("");
                setNumModal(null);
                showToast("UPI PIN updated successfully!");
              }}
            >
              Save UPI PIN
            </button>
            <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
          </>
        ) : (
          <>
            <b style={{ fontSize: 16 }}>{numModal === "mobile" ? "Pay to Mobile / UPI ID" : "Pay to Bank Account"}</b>
            <input
              placeholder={numModal === "mobile" ? "10-digit mobile or name@ekapp" : "Account Number / IFSC"}
              value={numInput}
              onChange={(e) => setNumInput(e.target.value)}
            />
            <button
              className="btn"
              onClick={() => {
                if (numInput.trim().length < 5) return showToast("Sahi details daalo");
                const newC = [numInput.trim(), numModal === "mobile" ? "EkPay Verified" : "Bank Transfer", numInput.trim().includes("@") ? numInput.trim() : numInput.trim() + "@ekapp"];
                setContacts([newC, ...contacts]);
                setPayToIdx(0);
                setPayAmt("");
                setNumModal(null);
                go("amt");
              }}
            >
              Proceed
            </button>
            <button className="btn o" onClick={() => setNumModal(null)}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
