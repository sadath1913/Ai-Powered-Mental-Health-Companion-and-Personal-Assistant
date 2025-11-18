// frontend/src/pages/Reminders.jsx
import React, { useContext, useEffect, useState } from "react";
import { userDataContext } from "../context/UserContext";

export default function Reminders() {
  const { getRemindersApi, createReminderApi, deleteReminderApi } = useContext(userDataContext);
  const [reminders, setReminders] = useState([]);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");

  const load = async () => {
    const r = await getRemindersApi();
    setReminders(r);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!text || !due) return alert("Enter text and due time");
    await createReminderApi({ text, dueAtIso: due });
    setText(""); setDue("");
    load();
  };

  const handleDelete = async (id) => {
    await deleteReminderApi(id);
    load();
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Reminders</h2>

      <div className="mb-4">
        <input value={text} onChange={(e)=>setText(e.target.value)} placeholder="Reminder text (e.g., take aspirin at 2pm)" className="border p-2 mr-2"/>
        <input value={due} onChange={(e)=>setDue(e.target.value)} placeholder="Due (ISO or '2025-11-13T14:00')" className="border p-2 mr-2"/>
        <button onClick={handleCreate} className="bg-blue-500 text-white px-3 py-1 rounded">Create</button>
      </div>

      <div>
        {reminders.length===0 ? <p>No reminders</p> : (
          <ul>
            {reminders.map(r=>(
              <li key={r._id} className="mb-2">
                <div><strong>{r.title}</strong></div>
                <div>{new Date(r.dueAt).toLocaleString()} {r.sentAt ? `(sent ${new Date(r.sentAt).toLocaleString()})` : ""}</div>
                <button onClick={()=>handleDelete(r._id)} className="text-red-600 mt-1">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
