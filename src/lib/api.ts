export interface PublicKeyResponse {
  n: string;
  g: string;
  pk_fingerprint: string;
}

const API_BASE = import.meta.env.VITE_API_URL

export type ElectionPublicKey = { n: string; g: string; pk_fingerprint: string };

export async function createElectionKeys(electionId: number): Promise<ElectionPublicKey> {
  const res = await fetch(`${API_BASE}/${electionId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Impossibile creare le chiavi per la votazione');
  return res.json();
}

export async function getPublicKey(electionId: number): Promise<ElectionPublicKey> {
  const res = await fetch(`${API_BASE}/${electionId}/public_key`);
  if (!res.ok) throw new Error('Chiave pubblica non trovata per questa votazione');
  return res.json();
}

export async function submitEncryptedVote(
  electionId: number,
  ciphertext: string,
  numUtenti: number,
  topic: string,

) {
  const res = await fetch(`${API_BASE}/${electionId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ ciphertext: ciphertext, topic: topic, num_utenti: numUtenti})
  });
  if (!res.ok) throw new Error('Invio voto fallito');
  return res.json();
}

export interface ResultResponse {
  status: string
}

export async function getResult(votazioneId: number, numUtenti: number): Promise<ResultResponse> {
  const res = await fetch(`${API_BASE}/${votazioneId}/result?num_utenti=${numUtenti}`, {
    method: "GET",
    headers: { 'Content-Type':'application/json' }
  });
  if (!res.ok) throw new Error(`Errore recupero risultati: ${res.status}`);
  return res.json();
}
