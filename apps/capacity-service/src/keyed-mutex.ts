/**
 * Serialisiert asynchrone Aufgaben pro Schlüssel: Aufgaben mit demselben
 * Schlüssel laufen strikt nacheinander, unterschiedliche Schlüssel parallel.
 *
 * Damit wird der kritische Abschnitt "freie Plätze zählen + Reservierung
 * anlegen" pro Topic atomar – auch wenn er `await`s enthält. Das bildet in
 * Node (single-threaded, aber kooperativ nebenläufig) genau das ab, was in
 * Postgres eine Zeilensperre/Transaktion leisten würde.
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();

  runExclusive<T>(key: string, task: () => Promise<T> | T): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    // An die vorige Aufgabe anhängen; Fehler der vorigen dürfen die Kette
    // nicht brechen, daher der geschluckte `catch`.
    const result = prev.then(() => task());
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    // Speicher aufräumen, sobald diese Aufgabe die letzte in der Kette war.
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}
