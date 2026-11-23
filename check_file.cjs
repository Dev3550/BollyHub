const EARNVIDS_KEY = '48914lqe3hwneiukt644z';

async function check(code) {
  const res = await (await fetch(`https://earnvids.com/api/file/info?key=${EARNVIDS_KEY}&file_code=${code}`)).json();
  console.log(`File [${code}]:`, JSON.stringify(res, null, 2));
}

const targetCode = process.argv[2] || 'm3qwozgyrc0x';
check(targetCode).catch(console.error);
