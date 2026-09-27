export async function api(path, options = {}) {
    // FormData (file uploads) must let the browser set its own multipart Content-Type
    const isForm = options.body instanceof FormData;
    const res = await fetch(`/api${path}`, {
        ...options,
        headers: isForm ? options.headers : { "Content-Type": "application/json", ...options.headers },
    });

    // an HTML error page (proxy down, 413, etc.) shouldn't surface as a JSON parse error
    const data = await res.json().catch(() => ({ error: `${res.status} ${res.statusText}` }));

    if (!res.ok) throw new Error(data.error || "Request Failed");

    return data;
}
