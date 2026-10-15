"""Starter registry of Egyptian hospitals.

This is a seed list, not an authoritative registry. It exists so the join
flow has something real to search on day one, and every entry here is a
hospital that operates in Egypt. It is not complete and was not derived
from a government source.

For a production deployment the authority should be GS1 Egypt's Healthcare
Location Register, which assigns each facility a verified Global Location
Number and is already aligned to MoHP and the Egyptian Drug Authority. A
GLN is a far better identity anchor than a name, because names repeat
across governorates and a GLN cannot.

Coordinates are deliberately absent. A wrong coordinate does not fail
loudly, it quietly misroutes an ambulance, so they are resolved by
geocoding through the Nominatim integration and then persisted. See
scripts/geocode_registry.py.
"""

# (english_name, arabic_name_or_None, governorate, aliases_or_None)
#
# Aliases matter more than they look. Hospitals are popularly known by names
# that are absent from any official list, so a search that misses them sends
# people to the claim form and produces review work that a lookup could have
# avoided. They are extra names to match on, never the primary identity.
SEED_REGISTRY = [
    # Cairo
    ("Cairo University Hospital", "مستشفى جامعة القاهرة", "Cairo", "Kasr El Aini|Kasr El Ainy|Qasr Al Aini|Cairo Univ"),
    ("Ain Shams University Hospital", "مستشفى عين شمس الجامعي", "Cairo", "Ain Shams|Helw El Asad|Ain Shams Univ"),
    ("Al-Azhar University Hospital", "مستشفى الأزهر", "Cairo", "Al Azhar|Azhar University|Al-Azhar Univ"),
    ("Al-Hussein University Hospital", "مستشفى الحسين الجامعي", "Cairo", "Al Hussein|Al-Hussein Hospital|Islamic Cairo"),
    ("Nasser Institute Hospital", "مستشفى ناصر", "Cairo", "Kasr El Aini Nasser|Nasser Institute"),
    ("Cleopatra Hospital", "مستشفى كليوباترا", "Cairo", "Cleopatra Hospital Cairo"),
    ("As-Salam International Hospital", "مستشفى السلام الدولي", "Cairo", "El Salam International|As-Salam Intl"),
    ("Dar Al Fouad Hospital", "مستشفى دار الفؤاد", "Cairo", "Dar Fouad|Dar Al Fouad"),
    ("Nile Badrawi Hospital", "مستشفى النيل بدراوي", "Cairo", "Nile Badrawi|Badrawi Hospital"),
    ("Egyptian German Hospital", "المستشفى الألماني المصري", "Cairo", "German Hospital|El German Hospital"),
    ("Misr International Hospital", "مستشفى مصر الدولي", "Cairo", "Misr Intl|Misr Hospital"),
    ("Al-Nahra Hospital", "مستشفى النور", "Cairo", "El Nahra|Nahra Hospital|Cairo Nahra"),
    ("Magdi Yacoub Heart Foundation Hospital", "مستشفى مجدي يعقوب", "Cairo", "Magdi Yacoub|My Heart Foundation"),
    ("57357 Children's Cancer Hospital", "مستشفى 57357", "Cairo", "57357|Children Cancer Hospital Egypt"),
    ("Al Agouza Hospital", "مستشفى العجوزة", "Cairo", "Agouza Hospital|El Agouza"),
    # Giza
    ("Giza University Hospital", "مستشفى جامعة الجيزة", "Giza", "Giza Univ"),
    ("Om El Masryeen General Hospital", "مستشفى أم القصريين العام", "Giza", "Om El Masryeen|Om El Masryeen Hospital"),
    ("6th of October Teaching Hospital", "مستشفى السادس من أكتوبر التعليمي", "Giza", "Sixth October Hospital|6th October Teaching"),
    # Alexandria
    ("Alexandria University Hospital", "مستشفى جامعة الإسكندرية", "Alexandria", "Alexandria Univ|El Shatby University Hospital"),
    ("Alexandria Medical Center", "المركز الطبي بالإسكندرية", "Alexandria", "Alexandria Medical Centre"),
    ("El Ramad Hospital", "مستشفى الرمد", "Alexandria", "Ramad Hospital|Alexandria Eye Hospital"),
    ("Dar Ismail Hospital", "مستشفى دار إسماعيل", "Alexandria", "Dar Ismail|El Dar Ismail"),
    # Delta
    ("Mansoura University Hospital", "مستشفى جامعة المنصورة", "Dakahlia", "Mansoura Univ|Mansourah University Hospital"),
    ("Mansoura University Children's Hospital", "مستشفى أطفال جامعة المنصورة", "Dakahlia", "Mansoura Children's Hospital"),
    ("Tanta University Hospital", "مستشفى جامعة طنطا", "Gharbia", "Tanta Univ"),
    ("Tanta University Hospital Heart Institute", "معهد القلب بمستشفى طنطا", "Gharbia", "Tanta Heart Institute|Magdi Yacoub Tanta"),
    ("Zagazig University Hospital", "مستشفى جامعة الزقازيق", "Sharqia", "Zagazig Univ"),
    ("Benha University Hospital", "مستشفى جامعة بنها", "Qalyubia", "Benha Univ"),
    ("Damanhour University Hospital", "مستشفى جامعة دمنهور", "Beheira", "Damanhour Univ|Damanhur University Hospital"),
    ("Kafr El Sheikh University Hospital", "مستشفى جامعة كفر الشيخ", "Kafr El Sheikh", "Kafr El Sheikh Univ|Kafr Elsheikh University Hospital"),
    ("Damietta University Hospital", "مستشفى جامعة دمياط", "Damietta", "Damietta Univ"),
    ("Al Shorouk Hospital", "مستشفى الشروق", "Monufia", "Al Shorouk Hospital|Shorouk Hospital Menoufia"),
    ("Shebin El Kom Teaching Hospital", "مستشفى شبين الكوم التعليمي", "Monufia", "Shebin El Kom|Shebin Elkom Hospital"),
    # Canal zone
    ("Ismailia University Hospital", "مستشفى جامعة الإسماعيلية", "Ismailia", "Ismailia Univ|Suez Canal Hospital Ismailia"),
    ("Suez Canal University Hospital", "مستشفى جامعة قناة السويس", "Suez", "Suez Canal Univ"),
    ("Port Said University Hospital", "مستشفى جامعة بورسعيد", "Port Said", "Port Said Univ"),
    ("Ismailia Specialized Hospital", "مستشفى الإسماعيلية التخصصي", "Ismailia", "Ismailia Specialized"),
    # Middle Egypt
    ("Minya University Hospital", "مستشفى جامعة المنيا", "Minya", "Minya Univ"),
    ("Beni Suef University Hospital", "مستشفى جامعة بني سويف", "Beni Suef", "Beni Suef Univ"),
    ("Fayoum University Hospital", "مستشفى جامعة الفيوم", "Fayoum", "Fayoum Univ"),
    # Upper Egypt
    ("Asyut University Hospital", "مستشفى جامعة أسيوط", "Asyut", "Asyut Univ|Assiut University Hospital"),
    ("Sohag University Hospital", "مستشفى جامعة سوهاج", "Sohag", "Sohag Univ"),
    ("Qena University Hospital", "مستشفى جامعة قنا", "Qena", "Qena Univ"),
    ("Luxor University Hospital", "مستشفى جامعة الأقصر", "Luxor", "Luxor Univ"),
    ("Aswan University Hospital", "مستشفى جامعة أسوان", "Aswan", "Aswan Univ"),
    # Frontier and coast
    ("Marsa Matrouh General Hospital", "المستشفى العام بمرسى مطروح", "Matrouh", "Matrouh General Hospital"),
    ("Al Arish University Hospital", "مستشفى جامعة العريش", "North Sinai", "Arish University Hospital"),
    ("Shubra El Kheima Hospital", "مستشفى شبرا الخيمة", "Qalyubia", "Shubra El Kheima|Shubra El Khaima"),
]
