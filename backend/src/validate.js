const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASS = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/;
// Returns an object of field -> message (empty when valid)
export function check(body, fields) {
  const e = {};
  const v = (k) => (typeof body[k] === 'string' ? body[k].trim() : '');
  if (fields.includes('name') && (v('name').length < 20 || v('name').length > 60)) e.name = 'Name must be 20-60 characters';
  if (fields.includes('storeName') && (!v('name') || v('name').length > 255)) e.name = 'Store name is required (max 255)';
  if (fields.includes('email') && !EMAIL.test(v('email'))) e.email = 'Enter a valid email';
  if (fields.includes('address') && (!v('address') || v('address').length > 400)) e.address = 'Address is required (max 400 characters)';
  if (fields.includes('password') && !PASS.test(body.password || '')) e.password = 'Password: 8-16 chars, one uppercase letter and one special character';
  return e;
}
