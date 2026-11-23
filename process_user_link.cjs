const fs = require('fs');
const path = require('path');

const EARNVIDS_KEY = '48914lqe3hwneiukt644z';
const rawInput = 'https://fastdl-one.pages.dev/?url=https://video-downloads.googleusercontent.com/ADGPM2m5nSlCn0nszByHATud8X-4OrZ6ywdIUUhF-8KhDaLzehykA4nDn7LUSyabKsPmmK0fU9XPYD2Kiod0PpE9qruF8cXXZSVM82PiItUo2GzoExKq3StOhzeW8VjD74pjXo0NXYjUVbEFh9ccx8uRzZ0WQMSMhDI5UlJGh8NucYtOg86aFAxcdgIJTJ1_Au-6Jh4N03MteyyXyZGCgyopAPurRjEErzo_w96k1G0YDpTsjgw0tkLBZKjiJlXTV2TXZ_5xNUbPt49p2AEN8LFsHp_X6xyJjBP3QvUeGiFzPrH8U23Yh1n8I8oE2PXU4uqMVfrCX960rrXBYP7CzYkQQtyUa6cfbxV-G1yPE_xwabCwlDzLpRyEC1lbo3I9eGkFiQYg5tLF2Rzv5YYOxTMYazfiAo72n9YCmCXXqLA6L4odbRt0rwVEwfT5-fDNiz6KfLzxbZWffAZdvXDRDhLSBKryJe1u-VTIoRqafxi3JVRsGawD6E47hgcK99jEWSel5RDp7WnRDXQbgArBdJEX-1Tkz76o2LXYgw6SRL234AXfDSD46gq_eypP3xmitgFTSjUyHIMcPKR9h6FeVTS0_tLsOmbQh3J7vuePUZPhQ68Yr_PEngsgHs1zbH4JCESc3nga9opox4pggQ4r1c60JgiE9rD4vgEVS2JK4wBMTJen_DFnkJrDEn1ZgtMWgaCzoxI0vqzyAWcSiSL7QPVSRUUVCGBwJv7RX0rP-VktuFV01eHWGt4H0jD91owyaLvqnGtoKwX3FRiX42rs8m96dklbXkRxKi7ksCACoqYKeADBEw5zLKQmPefWqrKKEqRyaCrvPfcslIkgdMvtszmHSMEOWxAm9i0hgtJSxJJ1Z-AJO5quxWU-bhxQLRckW0KLeRApmJUvemp2Zx6oKnmfEueyXm2cgI-YIk5tZtSQb93h6sGijnt-8WGInSdZ8U9dvsi_RT_obfc8dAXb5Lg4gEMjge3YjGxXZsODDyhvq3zlmJwfyUJHIcW-k8nVgiFAm_jnxRQx49lKRBJaFt0D_jmrGfWS4sljHNeqKxNq0rH9Dlt6rjZkErVkVlkzEkVgcdasDSLAy-KERioJDuvrDCpEQ0YzWg';

let directUrl = rawInput;
if (rawInput.includes('?url=')) {
  directUrl = rawInput.split('?url=')[1];
}

async function processUserMovie() {
  console.log('Target Direct URL:', directUrl.substring(0, 80) + '...');

  // 1. Check link from our machine
  console.log('\nChecking link response from Google CDN...');
  let title = 'Movie (720p)';
  let totalBytes = 0;
  try {
    const headRes = await fetch(directUrl, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-1024' }
    });
    console.log('HTTP Status:', headRes.status);
    console.log('Content-Type:', headRes.headers.get('content-type'));
    console.log('Content-Disposition:', headRes.headers.get('content-disposition'));
    const cd = headRes.headers.get('content-disposition');
    if (cd && cd.includes('filename=')) {
      const fn = cd.split('filename=')[1].replace(/["';]/g, '').trim();
      title = fn;
      console.log('Found actual filename:', title);
    }
    const cr = headRes.headers.get('content-range');
    if (cr && cr.includes('/')) {
      totalBytes = parseInt(cr.split('/')[1], 10);
      console.log('Total file size:', (totalBytes / (1024 * 1024)).toFixed(1), 'MB');
    }
  } catch (e) {
    console.error('Error probing link:', e.message);
  }

  // 2. Push to EarnVids Remote Queue
  console.log('\nPushing to EarnVids Remote Queue...');
  const pushUrl = `https://earnvids.com/api/upload/url?key=${EARNVIDS_KEY}&url=${encodeURIComponent(directUrl)}&fld_id=157402&title=${encodeURIComponent(title)}`;
  const pushRes = await (await fetch(pushUrl)).json();
  console.log('EarnVids Queue Response:', pushRes);

  if (pushRes.result?.filecode) {
    const filecode = pushRes.result.filecode;
    console.log('\n===============================================================');
    console.log('🎉 EARNVIDS FILECODE GENERATED:');
    console.log(`   Filecode: ${filecode}`);
    console.log(`   Live Embed Link: https://morencius.com/e/${filecode}`);
    console.log(`   Direct File Link: https://earnvids.com/e/${filecode}`);
    console.log('===============================================================');
  }

  // Check queue status
  const q = await (await fetch(`https://earnvids.com/api/file/url_uploads?key=${EARNVIDS_KEY}`)).json();
  console.log('\nCurrent Queue Status:');
  console.log(JSON.stringify(q.result?.slice(0, 3), null, 2));
}

processUserMovie().catch(console.error);
