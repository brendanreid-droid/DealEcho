import sys
from PIL import Image

def trim(image_path):
    print("Trimming", image_path)
    im = Image.open(image_path)
    
    # If the image has an alpha channel, we use it as the mask
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 0))
        diff = ImageChops.difference(im, bg)
        diff = ImageChops.add(diff, diff, 2.0, -100)
        # Bounding box given by alpha channel
        bbox = im.split()[-1].getbbox()
    else:
        # Get bounding box of non-background color (assuming white/transparent background)
        bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
        from PIL import ImageChops
        diff = ImageChops.difference(im, bg)
        diff = ImageChops.add(diff, diff, 2.0, -100)
        bbox = diff.getbbox()
        
    if bbox:
        im_cropped = im.crop(bbox)
        im_cropped.save(image_path)
        print("Trimmed to", bbox)
    else:
        print("No trimming needed")

if __name__ == "__main__":
    from PIL import ImageChops
    trim(sys.argv[1])
