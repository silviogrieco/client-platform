export interface PublicKeyResponse {
  n: string;
  g: string;
}

const API_BASE = import.meta.env.VITE_API_URL

export async function getPublicKey(): Promise<PublicKeyResponse> {
  const res = await fetch(`${API_BASE}/public_key`);
  if (!res.ok) throw new Error(`Errore recupero chiave pubblica: ${res.status}`);
  return res.json();
}

export async function submitEncryptedVote(votazioneId: number, ciphertext: string) {
  const res = await fetch(`${API_BASE}/submit_vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ votazione_id: votazioneId, ciphertext }),
  });
  if (!res.ok) throw new Error(`Errore invio voto: ${res.status}`);
  return res.json();
}

export interface ResultResponse {
  si?: number;
  no?: number;
  total?: number;
  yes?: number;
  no_count?: number;
  total_voters?: number;
}

export async function getResult(votazioneId: number): Promise<ResultResponse> {
  const res = await fetch(`${API_BASE}/get_result?votazione_id=${votazioneId}`);
  if (!res.ok) throw new Error(`Errore recupero risultati: ${res.status}`);
  return res.json();
}
